import "server-only";
import { z } from "zod";
import { oracle } from "@/server/api/transport";
import {
  label,
  resources,
  resourceVisible,
} from "@/server/configuration/resources";
import { authorizeForm } from "@/server/dynamic-form/access";
import { formGlobals } from "@/server/dynamic-form/globals";
import { sanitizeHtml } from "@/server/html/sanitize";
import { early } from "@/server/async";
import { AppError } from "@/lib/errors";
import {
  ATTRIBUTE_HOSTS,
  ATTRIBUTE_TYPES,
  type AttributeField,
  type AttributeHost,
  type AttributeText,
  type AttributesView,
} from "@/features/attributes/model";
const recordId = z.string().regex(/^[1-9]\d{0,14}$/);
const query = z
  .object({
    host: z.enum(ATTRIBUTE_HOSTS),
    parentId: recordId.optional(),
    objectId: recordId.optional(),
  })
  .strict();
type Query = z.infer<typeof query>;
interface Host {
  /** Sent as `p_obj_type`. */
  objectType: string;
  /** The RB bundle, a separate setting (KB F2): never derived from the object type. */
  bundle: string;
  /** Who may read the host page; throws when denied (fail closed). */
  authorize: (q: Query) => Promise<{ token: string }>;
}
const HOSTS: Record<AttributeHost, Host> = {
  "opportunities-eoi-application": {
    // ponytail: legacy's misspelt type (opportunities-eoi-application-start-page.html:18), kept on the wire until the
    // backend confirms which type EOI attributes are stored under (KB Framework-Patterns § 5).
    objectType: "OPPORTUNIES-EOI",
    bundle: "opportunities-eoi",
    // The Application tab's own rule: its role page on the record, or the Apply rules for a new application.
    authorize: (q) =>
      authorizeForm(
        {
          objectType: "OPPORTUNITIES",
          slot: "OPPORTUNITIES-EOI-APPLICATION",
          parentId: q.parentId,
          objectId: q.objectId,
        },
        "read",
      ),
  },
};
const TEXTS: Record<AttributeText, [string, string, string]> = {
  moreInfo: ["button-labels", "more_info", "More Info"],
  sourceCode: ["labels", "source-code", "Source code"],
  done: ["button-labels", "done", "Done"],
  cancel: ["button-labels", "cancel", "Cancel"],
};
const text = z.string().nullish();
const yn = z
  .string()
  .nullish()
  .transform((v) => (v === "Y" ? "Y" : "N") as "Y" | "N");
const name = z
  .string()
  .regex(/^attribute_\d{1,2}$/i)
  .transform((v) => v.toLowerCase());
const field = z.object({
  fieldId: z.coerce.number().int(),
  description: text.transform((v) => v ?? ""),
  fieldType: z.enum(ATTRIBUTE_TYPES),
  isVisible: text,
  isRequired: yn,
  isReadonly: yn,
  colspan: z.coerce.number().int().nullish().catch(null),
  attributeName: name,
  helperText: text.transform((v) => {
    const html = sanitizeHtml(v ?? "").trim();
    return html === "" ? null : html;
  }),
  regexValidation: text,
  regexDesc: text,
  parent_header_attr: name.nullish().catch(null),
  options: z
    .array(
      z.object({
        optionId: z.union([z.number(), z.string()]).transform(String),
        optionValue: z.union([z.string(), z.number()]).transform(String),
        parent_lkp_code: z
          .union([z.string(), z.number()])
          .nullish()
          .transform((v) => (v === null || v === undefined ? null : String(v))),
      }),
    )
    .nullish(),
});
/**
 * The body's fields as the display model. A field of an unknown type or name is dropped (legacy renders nothing for
 * it); `isVisible: 'N'` never reaches the browser. Field metadata is not RB: as legacy, only 'N' hides it.
 */
export function mapAttributes(raw: unknown): AttributeField[] {
  const parsed = z
    .object({ fields: z.array(z.unknown()).nullish() })
    .safeParse(raw);
  if (!parsed.success)
    throw new AppError("CONTRACT", "Oracle returned invalid attributes.");
  return (parsed.data.fields ?? []).flatMap((item) => {
    const r = field.safeParse(item);
    if (!r.success || r.data.isVisible === "N") return [];
    const f = r.data;
    return [
      {
        fieldId: f.fieldId,
        name: f.attributeName,
        description: f.description,
        fieldType: f.fieldType,
        isVisible: "Y",
        isRequired: f.isRequired,
        readOnly: f.isReadonly === "Y",
        colspan: f.colspan,
        helperText: f.helperText,
        regexValidation: f.regexValidation ?? null,
        regexDesc: f.regexDesc ?? null,
        parent_header_attr: f.parent_header_attr ?? null,
        options: f.options ?? [],
      },
    ];
  });
}
export function attributesQuery(q: URLSearchParams): Query {
  const value = (k: string) => {
    const v = q.get(k);
    return v === null || v === "" ? undefined : v;
  };
  const parsed = query.safeParse({
    host: value("host"),
    parentId: value("parentId"),
    objectId: value("objectId"),
  });
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid attributes request.", 400);
  return parsed.data;
}
/** GET: the host's attribute fields, after its access rule; none are read while `labels.show-attributes` is hidden. */
export async function loadAttributes(q: Query): Promise<AttributesView> {
  const host = HOSTS[q.host];
  const labels = early(resources()),
    settings = early(formGlobals());
  const { token } = await host.authorize(q);
  const rows = await labels;
  if (!resourceVisible(rows, host.bundle, "labels", "show-attributes"))
    return { visible: false };
  const [raw, globals] = await Promise.all([
    oracle("getSharedGetObjectAttributes", {
      token,
      p_obj_type: host.objectType,
      // A new record has no id yet; legacy sends "" (loadAttributes.js).
      p_obj_id: q.objectId ?? "",
    }),
    settings,
  ]);
  return {
    visible: true,
    fields: mapAttributes(raw),
    texts: Object.fromEntries(
      Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
        k,
        label(rows, host.bundle, group, key, fallback),
      ]),
    ) as Record<AttributeText, string>,
    decimals: globals.decimals,
  };
}
