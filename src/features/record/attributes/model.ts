import {
  fieldError,
  isBlank,
  optionsFor,
} from "@/features/record/dynamic-form/engine";
import type {
  DynField,
  FieldValue,
} from "@/features/record/dynamic-form/models";
/**
 * The shared object-attributes panel (legacy fragment `object-attributes`): `getSharedGetObjectAttributes` fields
 * keyed by their `attribute_N` name, as the server maps them for the browser.
 */
export const ATTRIBUTE_TYPES = [
  "TEXTBOX",
  "TEXTFIELD",
  "NUMERIC",
  "DATE",
  "LOV",
  "RICHTEXTEDITOR",
] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
/** A dynamic-form field (so the engine's option and validation rules apply) plus its attribute name. */
export interface AttributeField extends DynField {
  fieldType: AttributeType;
  /** `attribute_N`, lower-cased: the value's key and the host record's column. */
  name: string;
  readOnly: boolean;
}
export type AttributeText = "moreInfo" | "sourceCode" | "done" | "cancel";
/** GET /api/attributes: nothing at all while the host's `show-attributes` entry is not visible. */
export type AttributesView =
  | { visible: false }
  | {
      visible: true;
      fields: AttributeField[];
      texts: Record<AttributeText, string>;
      /** DECIMAL_PLACES_COUNT || 2. */
      decimals: number;
    };
export type AttributeValues = Record<string, FieldValue>;
/** The hosts the server knows, each with its own object type, bundle and access rule. */
export const ATTRIBUTE_HOSTS = ["opportunities-eoi-application"] as const;
export type AttributeHost = (typeof ATTRIBUTE_HOSTS)[number];
/** A dependent LOV's choices follow its parent attribute's current value. */
export const attributeOptions = (f: AttributeField, values: AttributeValues) =>
  optionsFor(
    f,
    isBlank(f.parent_header_attr)
      ? null
      : (values[String(f.parent_header_attr)] ?? null),
  );
export const attributeRequired = (f: AttributeField, editable: boolean) =>
  editable && !f.readOnly && f.isRequired === "Y";
/** Each editable field's error (required, then its regex), keyed by name; empty when the panel may be saved. */
export function attributeErrors(
  fields: AttributeField[],
  values: AttributeValues,
  editable: boolean,
): Record<string, string> {
  if (!editable) return {};
  return Object.fromEntries(
    fields.flatMap((f) => {
      if (f.readOnly) return [];
      const error = fieldError(
        f,
        values[f.name] ?? null,
        attributeRequired(f, editable),
      );
      return error === null ? [] : [[f.name, error]];
    }),
  );
}
/** The panel's values for the host's save: only the fields it shows, never anything else the browser holds. */
export function attributePick(
  fields: AttributeField[],
  values: AttributeValues,
): AttributeValues {
  return Object.fromEntries(
    fields.map((f) => [f.name, values[f.name] ?? null]),
  );
}
