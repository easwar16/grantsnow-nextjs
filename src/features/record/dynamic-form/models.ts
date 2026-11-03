/**
 * The dynamic-forms backend contract (`/dynamicForms/dynForms`, `/dynamicForms/dynFormResponse`), as the server maps it
 * for the browser. Everything is keyed formId → sectionId → fieldId, numeric ids from the backend; nothing by name.
 */
export type YesNo = "Y" | "N";
/** 'C': decided by the item's conditions. */
export type YesNoConditional = YesNo | "C";
export const FIELD_TYPES = [
  "TEXTBOX",
  "TEXTFIELD",
  "RICHTEXTEDITOR",
  "NUMERIC",
  "RADIO",
  "CHECKBOX",
  "CHECKLIST",
  "DATE",
  "LOV",
  "FILE",
  "COMBOBOXMANY",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export interface DynCondition {
  attribute: "isVisible" | "isRequired";
  conditionOperator: "IN" | "NOT IN";
  formId: number | string;
  sectionId: number | string;
  /** The field whose value is tested. */
  fieldId: number | string;
  optionId: (number | string)[];
}
export interface DynOption {
  optionId: number | string;
  optionValue: string;
  /** CSV of child fieldIds shown when this option is chosen. */
  dependent_fields?: string | null;
  /** CSV of parent optionIds, for a dependent LOV. */
  parent_lkp_code?: string | null;
}
export interface DynField {
  fieldId: number;
  /** The label (and, in a GRID, the column header). */
  description: string;
  fieldType: FieldType;
  isRequired: YesNo;
  isVisible: YesNoConditional;
  defaultValue?: string | null;
  colspan?: number | null;
  /** Decoded and sanitised on the server. */
  helperText?: string | null;
  regexValidation?: string | null;
  regexDesc?: string | null;
  /** The parent fieldId of a dependent LOV, in the same section. */
  parent_header_attr?: number | string | null;
  conditions?: DynCondition[] | null;
  options?: DynOption[] | null;
}
export interface DynSection {
  sectionId: number;
  sectionName: string;
  sectionType: "FORM" | "GRID";
  /** Width in twelfths. */
  colspan?: number | null;
  maxColumns?: number | null;
  isVisible: YesNoConditional;
  isMandatory: YesNo;
  helperText?: string | null;
  conditions?: DynCondition[] | null;
  fields: DynField[];
}
export interface DynForm {
  formId: number;
  formName?: string;
  sections: DynSection[];
}
/** One stored answer set, as read and as saved; values are strings, multi-values `~~`-joined on the way in. */
export interface DynResponse {
  form_id: number | string;
  sections: {
    section_id: number | string;
    fields: { field_id: number | string; value: unknown }[];
  }[];
}
/** A field's value in the form: a string, a number, a list of option ids, or nothing. */
export type FieldValue = string | number | string[] | null;
/** What GET /api/dynamic-form returns: the allowlisted display model, never a raw body. */
export interface DynamicFormData {
  forms: DynForm[];
  answers: DynResponse[];
  settings: {
    /** DECIMAL_PLACES_COUNT || 2. */
    decimals: number;
    /** DEFAULT_SIZE_FORMAT (MB) || 4. */
    maxMb: number;
    /** ALLOWED_EXTENSIONS as an `accept` list (`.pdf,.docx`); empty means any. */
    accept: string;
    /** False when OIC file storage is not configured: FILE fields cannot upload or download. */
    storage: boolean;
  };
  texts: Record<DynamicFormText, string>;
}
export type DynamicFormText =
  | "noData"
  | "dragAndDrop"
  | "noFile"
  | "download"
  | "delete"
  | "insertRow"
  | "edit"
  | "done"
  | "cancel"
  | "requiredFields"
  | "fileLarge"
  | "fileUnique"
  | "sourceCode"
  | "moreInfo"
  | "storageOff";
