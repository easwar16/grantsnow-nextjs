import type {
  DynCondition,
  DynField,
  DynForm,
  DynOption,
  DynResponse,
  DynSection,
  FieldValue,
} from "./models";
/**
 * The engine's rules as pure functions (port of GN-Angular dynamic-form.engine.ts, itself the VBCS `dynamic-form`
 * fragment). Server-safe: no React, no DOM. The model (model.ts) and the save validation on the server call these.
 */
/** Values by form → section → field id, as strings (ids come as numbers or strings from the backend). */
export type Values = Record<string, Record<string, Record<string, unknown>>>;
export type ValueOf = (
  formId: number | string,
  sectionId: number | string,
  fieldId: number | string,
) => unknown;
export const fieldKey = (
  formId: number | string,
  sectionId: number | string,
  fieldId: number | string,
) => `${formId}/${sectionId}/${fieldId}`;
export const sectionKey = (
  formId: number | string,
  sectionId: number | string,
) => `${formId}/${sectionId}`;
const MULTI = ["CHECKBOX", "CHECKLIST", "COMBOBOXMANY"];
export const isMulti = (f: Pick<DynField, "fieldType">) =>
  MULTI.includes(f.fieldType);
export const isBlank = (v: unknown) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);
/** matchesCondition: numeric IN / NOT IN of a value (or any of a list) against option ids. */
export function matches(
  operator: DynCondition["conditionOperator"],
  optionIds: (number | string)[],
  value: unknown,
): boolean {
  const ids = optionIds.map(Number).filter((n) => !Number.isNaN(n));
  const hit = (v: unknown) =>
    !isBlank(v) && !Number.isNaN(Number(v)) && ids.includes(Number(v));
  const found = Array.isArray(value) ? value.some(hit) : hit(value);
  return operator === "IN" ? found : !found;
}
const holds = (c: DynCondition, valueOf: ValueOf) =>
  matches(
    c.conditionOperator,
    c.optionId ?? [],
    valueOf(c.formId, c.sectionId, c.fieldId),
  );
/** A field or section is shown when 'Y', or 'C' with its isVisible condition holding (none: shown). */
export function isShown(
  item: Pick<DynField | DynSection, "isVisible" | "conditions">,
  valueOf: ValueOf,
): boolean {
  if (item.isVisible === "Y") return true;
  if (item.isVisible !== "C") return false;
  const c = item.conditions?.find((x) => x.attribute === "isVisible");
  return c ? holds(c, valueOf) : true;
}
/** checkConditions('required'): 'Y', or its isRequired condition holding. */
export function isRequired(field: DynField, valueOf: ValueOf): boolean {
  if (field.isRequired === "Y") return true;
  const c = field.conditions?.find((x) => x.attribute === "isRequired");
  return c ? holds(c, valueOf) : false;
}
const csvIds = (csv: string | null | undefined) =>
  String(csv ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((id) => id !== 0 && !Number.isNaN(id));
/**
 * deriveFieldConditionsFromDependentFields, without mutating the metadata: an option's `dependent_fields` becomes an
 * isVisible IN [optionId] condition on each child field (merged per parent, never duplicated).
 */
export function withDependentConditions(forms: DynForm[]): DynForm[] {
  return forms.map((form) => ({
    ...form,
    sections: form.sections.map((section) => {
      const derived = new Map<number, DynCondition[]>();
      section.fields.forEach((parent) =>
        parent.options?.forEach((option) =>
          csvIds(option.dependent_fields).forEach((childId) => {
            const list = derived.get(childId) ?? [];
            let rule = list.find(
              (c) => Number(c.fieldId) === Number(parent.fieldId),
            );
            if (!rule) {
              rule = {
                attribute: "isVisible",
                conditionOperator: "IN",
                formId: form.formId,
                sectionId: section.sectionId,
                fieldId: parent.fieldId,
                optionId: [],
              };
              list.push(rule);
            }
            if (!rule.optionId.map(Number).includes(Number(option.optionId)))
              rule.optionId.push(Number(option.optionId));
            derived.set(childId, list);
          }),
        ),
      );
      if (derived.size === 0) return section;
      return {
        ...section,
        fields: section.fields.map((f) => {
          const extra = derived.get(Number(f.fieldId));
          if (!extra) return f;
          // An authored isVisible rule on the same parent takes the derived option ids too.
          const conditions = (f.conditions ?? []).map((c) => ({
            ...c,
            optionId: [...(c.optionId ?? [])],
          }));
          extra.forEach((rule) => {
            const same = conditions.find(
              (c) =>
                c.attribute === "isVisible" &&
                Number(c.fieldId) === Number(rule.fieldId) &&
                Number(c.sectionId) === Number(rule.sectionId),
            );
            if (same)
              rule.optionId.forEach(
                (id) =>
                  same.optionId.map(Number).includes(Number(id)) ||
                  same.optionId.push(id),
              );
            else conditions.push(rule);
          });
          return { ...f, conditions };
        }),
      };
    }),
  }));
}
/** The stored responses as raw values by form → section → field. */
export function readResponses(responses: DynResponse[]): Values {
  const values: Values = {};
  responses.forEach((form) =>
    form.sections?.forEach((section) => {
      if (isBlank(section.section_id)) return;
      const s = ((values[String(form.form_id)] ??= {})[
        String(section.section_id)
      ] ??= {});
      section.fields?.forEach((f) => (s[String(f.field_id)] = f.value));
    }),
  );
  return values;
}
/** A field's empty value: none, or an empty list for the multi-value types. */
export const emptyValue = (field: Pick<DynField, "fieldType">): FieldValue =>
  isMulti(field) ? [] : null;
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/;
/** prepareFormValueObject, per field: the stored answer typed for the form, or the field's default. */
export function toFieldValue(field: DynField, raw: unknown): FieldValue {
  const value = isBlank(raw) ? (field.defaultValue ?? null) : raw;
  if (isBlank(value)) return emptyValue(field);
  switch (field.fieldType) {
    case "NUMERIC":
      return Number.isNaN(Number(value)) ? null : Number(value);
    case "CHECKBOX":
    case "CHECKLIST":
    case "COMBOBOXMANY":
      return Array.isArray(value)
        ? value.map(String)
        : String(value).split("~~");
    case "DATE":
      // A native date input takes yyyy-MM-dd; a stored timestamp keeps its date part.
      return ISO_DATE.exec(String(value))?.[1] ?? String(value);
    default:
      return String(value);
  }
}
/** A section starts on when it holds any answer, or always when mandatory. */
export function startsEnabled(
  section: Pick<DynSection, "isMandatory">,
  raw: Record<string, unknown> | undefined,
): boolean {
  if (section.isMandatory === "Y") return true;
  return Object.values(raw ?? {}).some(
    (v) => v !== null && v !== undefined && v !== "" && v !== false,
  );
}
/** calcColSpan: how many of the section's columns a field spans (its colspan is in twelfths). */
export function fieldSpan(
  colspan: number | null | undefined,
  maxColumns: number | null | undefined,
): number {
  const columns = Math.max(1, maxColumns || 1);
  const twelfths = Math.min(12, Math.max(1, colspan || 12));
  return Math.min(
    columns,
    Math.max(1, Math.round(columns / Math.floor(12 / twelfths))),
  );
}
/** The section's share of the row, from its colspan in twelfths. */
export const sectionWidth = (colspan: number | null | undefined) =>
  `${(Math.min(12, Math.max(1, colspan || 12)) / 12) * 100}%`;
/** The field's share of its section's columns, less the 16px column gap. */
export function fieldWidth(
  colspan: number | null | undefined,
  maxColumns: number | null | undefined,
) {
  const columns = Math.max(1, maxColumns || 1);
  return `calc(${(fieldSpan(colspan, maxColumns) / columns) * 100}% - 16px)`;
}
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
/** Helper text arrives entity-encoded (`&lt;p&gt;…`); decoded here (DOM-free), sanitised by the server after. */
export function decodeEntities(text: string | null | undefined): string {
  if (text === null || text === undefined || text === "") return "";
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code[0] !== "#") return NAMED[code.toLowerCase()] ?? whole;
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : Number(code.slice(1));
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : whole;
    },
  );
}
/** What the conditions decide, given the current values. */
export interface Resolution {
  hiddenSections: Set<string>;
  hiddenFields: Set<string>;
  required: Set<string>;
}
/** Bounded as cascadeClearHiddenFieldValues was. */
const MAX_PASSES = 16;
/**
 * Visibility and required-ness for every section and field. A hidden field reads as empty to the conditions that
 * test it, so hiding a parent hides its children in turn: resolved to a fixed point.
 */
export function resolve(forms: DynForm[], valueOf: ValueOf): Resolution {
  let hiddenFields = new Set<string>();
  let hiddenSections = new Set<string>();
  const effective: ValueOf = (f, s, x) =>
    hiddenFields.has(fieldKey(f, s, x)) || hiddenSections.has(sectionKey(f, s))
      ? null
      : valueOf(f, s, x);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const fields = new Set<string>();
    const sections = new Set<string>();
    forms.forEach((form) =>
      form.sections.forEach((section) => {
        if (!isShown(section, effective))
          sections.add(sectionKey(form.formId, section.sectionId));
        section.fields.forEach((field) => {
          if (!isShown(field, effective))
            fields.add(fieldKey(form.formId, section.sectionId, field.fieldId));
        });
      }),
    );
    const settled =
      fields.size === hiddenFields.size &&
      sections.size === hiddenSections.size &&
      [...fields].every((k) => hiddenFields.has(k)) &&
      [...sections].every((k) => hiddenSections.has(k));
    hiddenFields = fields;
    hiddenSections = sections;
    if (settled) break;
  }
  const required = new Set<string>();
  forms.forEach((form) =>
    form.sections.forEach((section) =>
      section.fields.forEach((field) => {
        const key = fieldKey(form.formId, section.sectionId, field.fieldId);
        if (!hiddenFields.has(key) && isRequired(field, effective))
          required.add(key);
      }),
    ),
  );
  return { hiddenSections, hiddenFields, required };
}
/** getOptions: a dependent LOV lists only the options under its parent's value, and nothing until there is one. */
export function optionsFor(
  field: DynField,
  parentValue: FieldValue,
): DynOption[] {
  const options = field.options ?? [];
  if (isBlank(field.parent_header_attr)) return options;
  if (isBlank(parentValue)) return [];
  return options.filter((o) =>
    String(o.parent_lkp_code ?? "")
      .split(",")
      .map((v) => v.trim())
      .includes(String(parentValue)),
  );
}
/** JET's required message, as the original shows it (measured live). */
export const REQUIRED_MESSAGE = "Enter a value.";
/**
 * The original's regex validator (JET RegExpValidator matches the whole value): the message, or null when it passes.
 * Rich text is tested as stored, HTML included, as the original's RTEValueChange did. A bad regex never blocks.
 */
export function patternError(
  field: DynField,
  value: FieldValue,
): string | null {
  if (!field.regexValidation || isBlank(value)) return null;
  let re: RegExp;
  try {
    re = new RegExp(`^(?:${field.regexValidation})$`);
  } catch {
    return null;
  }
  return re.test(String(value))
    ? null
    : field.regexDesc || `Enter value in '${field.regexValidation}' format`;
}
/** A live field's error: required and empty, else its format rule. */
export function fieldError(
  field: DynField,
  value: FieldValue,
  required: boolean,
): string | null {
  if (required && isBlank(value)) return REQUIRED_MESSAGE;
  return patternError(field, value);
}
/** NUMERIC on leaving the field: rounded to DECIMAL_PLACES_COUNT. */
export function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
/** One GRID row: a value per column, keyed by fieldId (the original keyed rows by column label). */
export type GridRow = Record<string, FieldValue>;
/** Grid columns edited in place; other types show their value (as the original's grid did). */
const GRID_EDITABLE = ["TEXTBOX", "TEXTFIELD", "NUMERIC", "DATE", "LOV"];
export const isGridEditable = (f: Pick<DynField, "fieldType">) =>
  GRID_EDITABLE.includes(f.fieldType);
/** A grid cell's typed value: numbers stay numbers, empty stays empty (the original turned an empty number into 0). */
function cellValue(field: DynField, raw: string | undefined): FieldValue {
  if (raw === undefined || raw === "") return null;
  if (field.fieldType === "NUMERIC")
    return Number.isNaN(Number(raw)) ? null : Number(raw);
  return raw;
}
/** A GRID section's stored columns (`~~`-joined, row i = token i) as rows. */
export function gridRows(
  section: DynSection,
  stored: Record<string, unknown> | undefined,
): GridRow[] {
  const columns = section.fields.map((f) => {
    const raw = stored?.[String(f.fieldId)];
    return { field: f, tokens: isBlank(raw) ? [] : String(raw).split("~~") };
  });
  const count = Math.max(0, ...columns.map((c) => c.tokens.length));
  return Array.from({ length: count }, (_, i) =>
    Object.fromEntries(
      columns.map((c) => [
        String(c.field.fieldId),
        cellValue(c.field, c.tokens[i]),
      ]),
    ),
  );
}
/** A new row: each column's default. */
export function newGridRow(section: DynSection): GridRow {
  return Object.fromEntries(
    section.fields.map((f) => [
      String(f.fieldId),
      cellValue(f, f.defaultValue ?? undefined),
    ]),
  );
}
/** The rows back as `~~`-joined columns, in row order; no rows sends each column empty, so the table is cleared. */
export function gridColumns(
  section: DynSection,
  rows: GridRow[],
): { field_id: string; value: string | null }[] {
  return section.fields.map((f) => ({
    field_id: String(f.fieldId),
    value: rows.length
      ? rows
          .map((r) => {
            const v = r[String(f.fieldId)];
            return v === null || v === undefined ? "" : String(v);
          })
          .join("~~")
      : null,
  }));
}
/** Every committed row has its required columns. */
export const gridRowsComplete = (section: DynSection, rows: GridRow[]) => {
  const required = section.fields
    .filter((f) => f.isRequired === "Y")
    .map((f) => String(f.fieldId));
  return !rows.some((row) => required.some((id) => isBlank(row[id])));
};
/** What the payload needs to know about the form's state. */
export interface PayloadSource {
  enabled: (formId: number, sectionId: number) => boolean;
  valueOf: (formId: number, sectionId: number, fieldId: number) => FieldValue;
  rowsOf: (formId: number, sectionId: number) => GridRow[];
  resolution: Resolution;
}
/** The save body: ids as strings, values typed; the server checks it against the form definition. */
export interface PayloadForm {
  form_id: string;
  sections: {
    section_id: string;
    fields: { field_id: string; value: FieldValue }[];
  }[];
}
/**
 * preparePayload: enabled sections only, ids as strings, multi-values as lists (the backend joins them), GRID columns
 * `~~`-joined. A field hidden by a condition (or in a hidden section) is sent empty, so a hidden question keeps no
 * stale answer.
 */
export function toPayload(forms: DynForm[], src: PayloadSource): PayloadForm[] {
  return forms
    .map((form) => ({
      form_id: String(form.formId),
      sections: form.sections
        .filter((section) => src.enabled(form.formId, section.sectionId))
        .map((section) => {
          const sKey = sectionKey(form.formId, section.sectionId);
          if (section.sectionType === "GRID")
            return {
              section_id: String(section.sectionId),
              fields: gridColumns(
                section,
                src.rowsOf(form.formId, section.sectionId),
              ),
            };
          return {
            section_id: String(section.sectionId),
            fields: section.fields.map((field) => {
              const hidden =
                src.resolution.hiddenSections.has(sKey) ||
                src.resolution.hiddenFields.has(
                  fieldKey(form.formId, section.sectionId, field.fieldId),
                );
              return {
                field_id: String(field.fieldId),
                value: hidden
                  ? emptyValue(field)
                  : src.valueOf(form.formId, section.sectionId, field.fieldId),
              };
            }),
          };
        })
        .filter((section) => section.fields.length > 0),
    }))
    .filter((form) => form.sections.length > 0);
}
/** A FILE value is `fileName~~attachmentId`; just the name while the file waits to be uploaded. */
export const fileNameOf = (value: FieldValue): string =>
  typeof value === "string" ? value.split("~~")[0] : "";
export const fileIdOf = (value: FieldValue): number | null => {
  const id = typeof value === "string" ? value.split("~~")[1] : undefined;
  return id === undefined || id === "" || Number.isNaN(Number(id))
    ? null
    : Number(id);
};
export const fileValue = (name: string, id: number | null): string =>
  id === null ? name : `${name}~~${id}`;
/** The original's file-should-be-unique rule: a name already held by another FILE field of the form. */
export function fileNameTaken(
  forms: DynForm[],
  valueOf: ValueOf,
  name: string,
  exceptKey: string,
): boolean {
  return forms.some((form) =>
    form.sections.some(
      (section) =>
        section.sectionType === "FORM" &&
        section.fields.some(
          (f) =>
            f.fieldType === "FILE" &&
            fieldKey(form.formId, section.sectionId, f.fieldId) !== exceptKey &&
            fileNameOf(
              valueOf(form.formId, section.sectionId, f.fieldId) as FieldValue,
            ) === name,
        ),
    ),
  );
}
/** DEFAULT_SIZE_FORMAT (MB), 4 when unset or invalid, as the original. */
export function maxMbOf(raw: unknown) {
  const n = Number(raw);
  return raw !== null && raw !== "" && Number.isFinite(n) && n > 0 ? n : 4;
}
/** getAllowedExtensions: ALLOWED_EXTENSIONS as `.ext` for a file input's accept; empty means any. */
export function acceptOf(allowed: unknown): string {
  return (typeof allowed === "string" ? allowed : "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t !== "")
    .map((t) => `.${t.replace(/^\./, "")}`)
    .join(",");
}
/** A picked file's problem, or null: over the size limit, or not an allowed type. */
export function fileProblem(
  file: { name: string; size: number },
  maxMb: number,
  accept: string,
): string | null {
  if (file.size > maxMb * 1024 * 1024)
    return `File size should be less than ${maxMb}MB`;
  if (
    accept !== "" &&
    !accept.split(",").some((ext) => file.name.toLowerCase().endsWith(ext))
  )
    return "This file type is not allowed";
  return null;
}
