import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { sanitizeHtml } from "@/server/html/sanitize";
import { decodeEntities } from "@/features/dynamic-form/engine";
import {
  FIELD_TYPES,
  type DynCondition,
  type DynField,
  type DynForm,
  type DynResponse,
  type FieldType,
} from "@/features/dynamic-form/models";
/**
 * The dynForms / dynFormResponse bodies mapped to the allowlisted display model (zod strips every other key), and the
 * save body checked against that definition. Helper text and rich-text answers are sanitised here, once.
 */
const id = z
  .union([z.number(), z.string().regex(/^\d{1,15}$/)])
  .transform(Number);
const text = z.string().nullish();
const yn = z
  .string()
  .nullish()
  .transform((v) => (v === "Y" ? "Y" : "N") as "Y" | "N");
const visibility = z
  .string()
  .nullish()
  .transform((v) => (v === "Y" || v === "C" ? v : "N") as "Y" | "N" | "C");
const count = z.coerce.number().int().nullish().catch(null);
const condition = z.object({
  attribute: z.enum(["isVisible", "isRequired"]),
  conditionOperator: z.enum(["IN", "NOT IN"]),
  formId: z.union([z.number(), z.string()]),
  sectionId: z.union([z.number(), z.string()]),
  fieldId: z.union([z.number(), z.string()]),
  optionId: z.array(z.union([z.number(), z.string()])).nullish(),
});
// A malformed condition is dropped (degrade, don't abort): the item then shows as its own flag says.
const conditions = z
  .array(z.unknown())
  .nullish()
  .transform((list): DynCondition[] =>
    (list ?? []).flatMap((c) => {
      const r = condition.safeParse(c);
      return r.success ? [{ ...r.data, optionId: r.data.optionId ?? [] }] : [];
    }),
  );
const helper = text.transform((v) => {
  const html = sanitizeHtml(decodeEntities(v)).trim();
  return html === "" ? null : html;
});
const field = z.object({
  fieldId: id,
  description: text.transform((v) => v ?? ""),
  fieldType: z.string(),
  isRequired: yn,
  isVisible: visibility,
  defaultValue: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v === null || v === undefined ? null : String(v))),
  colspan: count,
  helperText: helper,
  regexValidation: text,
  regexDesc: text,
  parent_header_attr: z.union([z.number(), z.string()]).nullish(),
  conditions,
  options: z
    .array(
      z.object({
        optionId: z.union([z.number(), z.string()]),
        optionValue: z.union([z.string(), z.number()]).transform(String),
        dependent_fields: z
          .union([z.string(), z.number()])
          .nullish()
          .transform((v) => (v === null || v === undefined ? null : String(v))),
        parent_lkp_code: z
          .union([z.string(), z.number()])
          .nullish()
          .transform((v) => (v === null || v === undefined ? null : String(v))),
      }),
    )
    .nullish(),
});
const section = z.object({
  sectionId: id,
  sectionName: text.transform((v) => v ?? ""),
  sectionType: z.string().nullish(),
  colspan: count,
  maxColumns: count,
  isVisible: visibility,
  isMandatory: yn,
  helperText: helper,
  conditions,
  fields: z.array(z.unknown()).nullish(),
});
const form = z.object({
  formId: id,
  formName: text,
  sections: z.array(section).nullish(),
});
const isFieldType = (t: string): t is FieldType =>
  (FIELD_TYPES as readonly string[]).includes(t);
/** dynForms → forms. A field of an unknown type (or malformed) is left out rather than failing the form. */
export function mapForms(raw: unknown): DynForm[] {
  if (!Array.isArray(raw)) return [];
  return z
    .array(form)
    .parse(raw)
    .map((f) => ({
      formId: f.formId,
      ...(f.formName ? { formName: f.formName } : {}),
      sections: (f.sections ?? []).map((s) => ({
        sectionId: s.sectionId,
        sectionName: s.sectionName,
        sectionType:
          s.sectionType === "GRID" ? ("GRID" as const) : ("FORM" as const),
        colspan: s.colspan,
        maxColumns: s.maxColumns,
        isVisible: s.isVisible,
        isMandatory: s.isMandatory,
        helperText: s.helperText,
        conditions: s.conditions,
        fields: (s.fields ?? []).flatMap((x): DynField[] => {
          const r = field.safeParse(x);
          if (!r.success || !isFieldType(r.data.fieldType)) return [];
          return [{ ...r.data, fieldType: r.data.fieldType }];
        }),
      })),
    }));
}
const response = z.array(
  z.object({
    form_id: z.union([z.number(), z.string()]),
    sections: z
      .array(
        z.object({
          section_id: z.union([z.number(), z.string()]).nullish(),
          fields: z
            .array(
              z.object({
                field_id: z.union([z.number(), z.string()]),
                value: z.unknown(),
              }),
            )
            .nullish(),
        }),
      )
      .nullish(),
  }),
);
/** A stored value as the form reads it: text, a number, a list of text; anything else is no answer. */
function storedValue(value: unknown, rich: boolean): unknown {
  if (typeof value === "string") return rich ? sanitizeHtml(value) : value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value))
    return value
      .filter((v) => typeof v === "string" || typeof v === "number")
      .map(String);
  return null;
}
/** dynFormResponse → answers, only for the forms' known fields; rich text sanitised. */
export function mapAnswers(raw: unknown, forms: DynForm[]): DynResponse[] {
  if (!Array.isArray(raw)) return [];
  return response.parse(raw).flatMap((r) => {
    const f = forms.find((x) => String(x.formId) === String(r.form_id));
    if (!f) return [];
    return [
      {
        form_id: f.formId,
        sections: (r.sections ?? []).flatMap((rs) => {
          const s = f.sections.find(
            (x) => String(x.sectionId) === String(rs.section_id),
          );
          if (!s) return [];
          return [
            {
              section_id: s.sectionId,
              fields: (rs.fields ?? []).flatMap((rf) => {
                const d = s.fields.find(
                  (x) => String(x.fieldId) === String(rf.field_id),
                );
                return d
                  ? [
                      {
                        field_id: d.fieldId,
                        value: storedValue(
                          rf.value,
                          s.sectionType === "FORM" &&
                            d.fieldType === "RICHTEXTEDITOR",
                        ),
                      },
                    ]
                  : [];
              }),
            },
          ];
        }),
      },
    ];
  });
}
// Rich text and grids can be long; everything else is a short answer.
const MAX_TEXT = 100_000;
const ID = /^\d{1,15}$/;
const answersShape = z
  .array(
    z.object({
      form_id: z.string().regex(ID),
      sections: z
        .array(
          z.object({
            section_id: z.string().regex(ID),
            fields: z
              .array(
                z.object({
                  field_id: z.string().regex(ID),
                  value: z.union([
                    z.string().max(MAX_TEXT),
                    z.number().finite(),
                    z.array(z.string().max(40)).max(500),
                    z.null(),
                  ]),
                }),
              )
              .max(500),
          }),
        )
        .max(200),
    }),
  )
  .max(20);
export type CheckedAnswers = {
  form_id: string;
  sections: {
    section_id: string;
    fields: { field_id: string; value: string | number | string[] | null }[];
  }[];
}[];
const mismatch = () =>
  new AppError("BAD_REQUEST", "The answers do not match this form.", 400);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `name` or `name~~attachmentId`; no path separators or control characters in the name. */
function fileValueOk(value: string) {
  const [name, attachment, ...rest] = value.split("~~");
  return (
    rest.length === 0 &&
    /^[^/\\\u0000-\u001f]{1,255}$/.test(name) &&
    (attachment === undefined || /^\d{1,15}$/.test(attachment))
  );
}
function checkValue(def: DynField, grid: boolean, value: unknown) {
  const options = new Set((def.options ?? []).map((o) => String(o.optionId)));
  const one = (v: unknown) => typeof v === "string" && options.has(v);
  if (value === null) return null;
  if (grid) {
    if (typeof value !== "string") throw mismatch();
    return value;
  }
  switch (def.fieldType) {
    case "NUMERIC":
      if (typeof value !== "number") throw mismatch();
      return value;
    case "CHECKBOX":
    case "CHECKLIST":
    case "COMBOBOXMANY":
      if (
        !Array.isArray(value) ||
        !value.every(one) ||
        new Set(value).size !== value.length
      )
        throw mismatch();
      return value as string[];
    case "RADIO":
    case "LOV":
      if (!one(value)) throw mismatch();
      return value as string;
    case "DATE":
      if (typeof value !== "string" || !DATE.test(value)) throw mismatch();
      return value;
    case "FILE":
      if (typeof value !== "string" || !fileValueOk(value)) throw mismatch();
      return value;
    case "RICHTEXTEDITOR":
      if (typeof value !== "string") throw mismatch();
      return sanitizeHtml(value);
    default:
      if (typeof value !== "string") throw mismatch();
      return value;
  }
}
/**
 * The save body checked against the loaded definition: only known form / section / field ids, each once, values of
 * the field's shape (option ids among its options). Rebuilt as an explicit pick; rich text sanitised.
 */
export function checkAnswers(forms: DynForm[], raw: unknown): CheckedAnswers {
  const parsed = answersShape.safeParse(raw);
  if (!parsed.success) throw mismatch();
  const seenForms = new Set<string>();
  return parsed.data.map((rf) => {
    const f = forms.find((x) => String(x.formId) === rf.form_id);
    if (!f || seenForms.has(rf.form_id)) throw mismatch();
    seenForms.add(rf.form_id);
    const seenSections = new Set<string>();
    return {
      form_id: rf.form_id,
      sections: rf.sections.map((rs) => {
        const s = f.sections.find((x) => String(x.sectionId) === rs.section_id);
        if (!s || seenSections.has(rs.section_id)) throw mismatch();
        seenSections.add(rs.section_id);
        const seenFields = new Set<string>();
        return {
          section_id: rs.section_id,
          fields: rs.fields.map((rx) => {
            const d = s.fields.find((x) => String(x.fieldId) === rx.field_id);
            if (!d || seenFields.has(rx.field_id)) throw mismatch();
            seenFields.add(rx.field_id);
            return {
              field_id: rx.field_id,
              value: checkValue(d, s.sectionType === "GRID", rx.value),
            };
          }),
        };
      }),
    };
  });
}
