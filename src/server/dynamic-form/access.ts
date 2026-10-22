import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { requireModule } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { dashboardRoles } from "@/server/configuration/service";
import { pageAccess } from "@/server/opportunities/gates";
import { canCreate } from "@/features/opportunities/display";
import { AppError } from "@/lib/errors";
import { early } from "@/server/async";
import { cachedRead } from "@/server/cache/reads";
import { TTL } from "@/server/cache/memo";
/**
 * Who may read or change a dynamic form (and its files), decided on the server and failing closed. Today only the EOI
 * hosts: the Application tab (OPPORTUNITIES / OPPORTUNITIES-EOI-APPLICATION) and Dynamic Form 1–5
 * (OPPORTUNITIES-EOI / OPPORTUNITIES-EOI-DYNAMIC-FORM-N). Other object types are refused until their hosts exist.
 */
const recordId = z.string().regex(/^[1-9]\d{0,14}$/);
export const formTarget = z
  .object({
    objectType: z.string().regex(/^[A-Z_-]{1,40}$/),
    slot: z.string().regex(/^[A-Z0-9_-]{1,80}$/),
    parentId: recordId.optional(),
    objectId: recordId.optional(),
  })
  .strict();
export type FormTarget = z.infer<typeof formTarget>;
/** Query params (empty means absent) → a target; anything malformed is a 400. */
export function targetFromQuery(q: URLSearchParams): FormTarget {
  const value = (k: string) => {
    const v = q.get(k);
    return v === null || v === "" ? undefined : v;
  };
  const parsed = formTarget.safeParse({
    objectType: value("objectType"),
    slot: value("slot"),
    parentId: value("parentId"),
    objectId: value("objectId"),
  });
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
  return parsed.data;
}
const denied = (message = "You do not have access to this page.") =>
  new AppError("FORBIDDEN", message, 403);
/** The record's role page for the slot (`opportunities-eoi-<tab>`, GN-Angular eoi.ts); null for an unsupported host. */
export function pageOf(t: Pick<FormTarget, "objectType" | "slot">) {
  if (
    t.objectType === "OPPORTUNITIES" &&
    t.slot === "OPPORTUNITIES-EOI-APPLICATION"
  )
    return "opportunities-eoi-application";
  if (
    t.objectType === "OPPORTUNITIES-EOI" &&
    /^OPPORTUNITIES-EOI-DYNAMIC-FORM-[1-5]$/.test(t.slot)
  )
    return t.slot.toLowerCase();
  return null;
}
const rolesSchema = z.object({
  items: z.array(
    z.object({
      page_name: z.string(),
      read_access: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
      edit_access: z.string().nullish(),
    }),
  ),
});
const detailsSchema = z.object({
  items: z.array(
    z.object({
      request_id: z.coerce.number().int().positive(),
      request_number: z.string().min(1),
      request_type: z.string(),
      status_code: z.string().nullish(),
      ref_object_id: z.coerce.number().int().positive().nullish(),
    }),
  ),
});
const opportunitySchema = z.object({
  items: z.array(
    z.object({
      opportunities_id: z.coerce.number().int().positive(),
      opportunity_status: z.string().nullish(),
      create_application_of_interest: z.string().nullish(),
    }),
  ),
});
/** A new application's form: the Apply rules (apply-opportunities read, the opportunity's flag, an open status). */
async function requireApply(token: string, opportunityId: string | undefined) {
  if (opportunityId === undefined)
    throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
  // Read together; the role check still decides first, and nothing is returned before both pass.
  const opportunity = early(
    oracle(
      "getSharedGetOpportunities",
      { token, p_order_by: "publication_date", p_sort_order: "DESC" },
      new URLSearchParams({
        p_where_clause: `("opportunities_id"='${opportunityId}')`,
        p_offset: "0",
        p_limit: "1",
      }),
    ),
  );
  if (!pageAccess(await dashboardRoles(), "apply-opportunities").read)
    throw denied("This action is not enabled for your account.");
  const o = opportunitySchema
    .parse(await opportunity)
    .items.find((r) => String(r.opportunities_id) === opportunityId);
  if (
    !o ||
    o.create_application_of_interest !== "Y" ||
    !canCreate(o.opportunity_status ?? "")
  )
    throw denied("Applications are not open for this opportunity.");
}
export interface FormRecord {
  id: string;
  /** The record number (`AOI_513`), the storage folder; read here, never taken from the browser. */
  number: string;
}
/**
 * Read: the record's role rows grant the page. Edit: every row also grants edit and the application is a draft.
 * Without a record only a new application's form can be read, under the Apply rules.
 */
export async function authorizeForm(t: FormTarget, mode: "read" | "edit") {
  const { session, user } = await authenticate();
  const page = pageOf(t);
  if (page === null)
    throw denied("Forms are not available for this record type.");
  requireModule(user, "opportunities-group");
  const token = session.token;
  if (t.objectId === undefined) {
    if (mode === "edit" || t.objectType !== "OPPORTUNITIES")
      throw new AppError("BAD_REQUEST", "Save the application first.", 400);
    await requireApply(token, t.parentId);
    return { token, user, page, record: null };
  }
  // Read together; the role check still decides first, and nothing is returned before every check passes.
  const requestDetails = early(
    oracle("getDynamicFormsGetRequestDetails", {
      token,
      request_id: t.objectId,
    }),
  );
  const roles = rolesSchema.parse(
    // The same held answer the EOI record reads (one roles read per record, as VBCS).
    await cachedRead(
      "getSecurityUser_roles",
      { token, p_obj_id: t.objectId, p_obj_type: "OPPORTUNITIES-EOI" },
      TTL.access,
    ),
  ).items;
  const access = pageAccess(roles, page);
  if (!access.read || (mode === "edit" && !access.edit)) throw denied();
  const details = detailsSchema.parse(await requestDetails).items;
  const r = details[0];
  if (
    details.length !== 1 ||
    String(r.request_id) !== t.objectId ||
    r.request_type !== "OPPORTUNITIES-EOI"
  )
    throw new AppError("CONTRACT", "Oracle returned a different application.");
  // The Application tab's opportunity must be the one the record was made from.
  if (
    t.objectType === "OPPORTUNITIES" &&
    t.parentId !== undefined &&
    String(r.ref_object_id ?? "") !== t.parentId
  )
    throw new AppError(
      "BAD_REQUEST",
      "The application does not belong to this opportunity.",
      400,
    );
  if (mode === "edit" && r.status_code !== "DRFT")
    throw denied("Only a draft application can be changed.");
  const record: FormRecord = { id: t.objectId, number: r.request_number };
  return { token, user, page, record };
}
