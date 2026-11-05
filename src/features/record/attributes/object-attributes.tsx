"use client";
import { useImperativeHandle, useState } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { DateInput } from "@/components/ui/date-input";
import { HelpButton } from "@/components/ui/help-button";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { RichText } from "@/components/ui/rich-text";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/features/record/dynamic-form/dyn-field";
import { fieldWidth, isBlank } from "@/features/record/dynamic-form/engine";
import type { FieldValue } from "@/features/record/dynamic-form/models";
import { attributes, useApi } from "@/lib/api";
import {
  attributeErrors,
  attributeOptions,
  attributePick,
  attributeRequired,
  type AttributeField,
  type AttributeHost,
  type AttributeValues,
} from "./model";
import styles from "./attributes.module.css";
import { functions } from "@/lib/functions";
/** What a host's save calls, in order: `check()` before its own save, `reload()` once that save has passed. */
export interface AttributesHandle {
  /** Shows every field's error; true when the host may save (hidden, failed to load, or all fields pass). */
  check: () => boolean;
  /** The shown fields' values for the host's own save body; null when the panel shows nothing. */
  values: () => AttributeValues | null;
  /** Re-reads the fields after a save: they can depend on what was saved (9323). */
  reload: () => void;
}
// Legacy holds 6 columns (oj-form-layout max-columns="6").
const COLUMNS = 6;
/**
 * The shared object-attributes panel (legacy fragment `object-attributes`, 8 hosts). It shows only when the host's
 * bundle has `labels.show-attributes` visible (checked on the server). Values start from the host record and are
 * saved by the host, after `check()`, in its own body; the panel writes nothing itself.
 */
export function ObjectAttributes({
  id,
  host,
  parentId,
  objectId,
  editable,
  displayOnly = false,
  initial = {},
  plain,
  outsideLabels = false,
  ref,
}: {
  /** The panel's page-unique id; fields take `${id}-attribute-n`. */
  id: string;
  host: AttributeHost;
  parentId?: string;
  objectId?: string;
  editable: boolean;
  /** Render view-mode values as text, as on the legacy Proposal Summary. */
  displayOnly?: boolean;
  /** The record's `attribute_N` values (legacy getAttributeValues). */
  initial?: AttributeValues;
  /** Inside the host's own panel (the award header): no border of its own. */
  plain?: boolean;
  /** Proposal creation uses the VBCS Summary form's labels above its controls. */
  outsideLabels?: boolean;
  ref?: React.Ref<AttributesHandle>;
}) {
  const { data, error, retry } = useApi(attributes.fields, {
    host,
    parentId,
    objectId,
  });
  const [values, setValues] = useState<AttributeValues>(initial),
    [touched, setTouched] = useState<ReadonlySet<string>>(new Set()),
    [checked, setChecked] = useState(false);
  const fields = data?.visible ? data.fields : [];
  const errors = attributeErrors(fields, values, editable);
  useImperativeHandle(ref, () => ({
    check: () => {
      setChecked(true);
      if (data === undefined) return error !== undefined;
      return Object.keys(errors).length === 0;
    },
    values: () =>
      data?.visible && fields.length > 0 ? attributePick(fields, values) : null,
    reload: retry,
  }));
  if (error)
    return (
      <State
        id={`${id}-error`}
        title="Attributes could not be loaded"
        message={error.message}
        code={error.code}
        action={error.action}
        retry={retry}
      />
    );
  if (data === undefined)
    return <Skeleton kind="lines" count={2} label="Loading attributes" />;
  if (!data.visible || fields.length === 0) return null;
  const set = (name: string, value: FieldValue) =>
    setValues((v) => ({ ...v, [name]: value }));
  const touch = (name: string) =>
    setTouched((t) => (t.has(name) ? t : new Set(t).add(name)));
  const control = (f: AttributeField, fieldId: string, shownError: boolean) => {
    const value = values[f.name] ?? null,
      live = editable && !f.readOnly,
      required = attributeRequired(f, editable),
      aria = {
        "aria-invalid": shownError || undefined,
        "aria-describedby": shownError ? `${fieldId}-error` : undefined,
        "aria-required": required || undefined,
      } as const;
    const inside = (child: React.ReactNode) => outsideLabels ? (
      <div className={styles.outsideField}>
        <label htmlFor={f.fieldType === "LOV" ? `${fieldId}-trigger` : fieldId}>
          {f.description}{required && <span className={styles.required}> *</span>}
        </label>
        {child}
      </div>
    ) : (
      <InsideField
        htmlFor={f.fieldType === "LOV" ? `${fieldId}-trigger` : fieldId}
        label={f.description}
        filled={!isBlank(value)}
        required={required}
      >
        {child}
      </InsideField>
    );
    switch (f.fieldType) {
      case "RICHTEXTEDITOR":
        return (
          <RichText
            id={fieldId}
            label={f.description}
            value={typeof value === "string" ? value : null}
            onChange={(html) => set(f.name, html)}
            onBlur={() => touch(f.name)}
            invalid={shownError}
            readOnly={!live}
            texts={data.texts}
          />
        );
      case "NUMERIC":
        return inside(
          <NumberInput
            id={fieldId}
            value={value}
            decimals={data.decimals}
            disabled={!live}
            onChange={(n) => set(f.name, n)}
            onBlur={() => touch(f.name)}
            {...aria}
          />,
        );
      case "DATE":
        return inside(
          <DateInput
            id={fieldId}
            value={typeof value === "string" ? value : ""}
            disabled={!live}
            required={required}
            invalid={shownError}
            describedBy={shownError ? `${fieldId}-error` : undefined}
            onChange={(date) => set(f.name, date === "" ? null : date)}
            onBlur={() => touch(f.name)}
          />,
        );
      case "LOV":
        return inside(
          <Select
            id={fieldId}
            label={f.description}
            options={attributeOptions(f, values).map((o) => ({
              value: String(o.optionId),
              label: o.optionValue,
            }))}
            value={typeof value === "string" ? value : ""}
            disabled={!live}
            invalid={shownError}
            onChange={(next) => {
              set(f.name, next === "" ? null : next);
              touch(f.name);
            }}
          />,
        );
      default:
        return inside(
          <input
            id={fieldId}
            type="text"
            value={typeof value === "string" ? value : ""}
            disabled={!live}
            onChange={(e) => set(f.name, e.target.value)}
            onBlur={() => touch(f.name)}
            {...aria}
          />,
        );
    }
  };
  // Legacy readonly form: each field's label over its value as text, one under another; a blank value shows no line.
  const text = (f: AttributeField) => {
    const value = values[f.name] ?? null;
    if (isBlank(value)) return null;
    if (f.fieldType === "LOV")
      return (
        attributeOptions(f, values).find((o) => String(o.optionId) === value)
          ?.optionValue ?? String(value)
      );
    return f.fieldType === "DATE"
      ? functions.format.dateDisplay(String(value))
      : String(value);
  };
  if (!editable)
    return (
      <section
        id={id}
        className={`${styles.readonly} ${plain ? "" : styles.panel}`}
        aria-label="Attributes"
      >
        {fields.map((f) => {
          const fieldId = `${id}-${functions.ids.idPart(f.name)}`;
          const help = (
            <HelpButton
              id={`${fieldId}-help`}
              html={f.helperText}
              label={data.texts.moreInfo}
            />
          );
          return f.fieldType === "RICHTEXTEDITOR" ? (
            <div key={f.name} className={styles.row}>
              {control(f, fieldId, false)}
              {help}
            </div>
          ) : (
            <ReadonlyField
              key={f.name}
              id={fieldId}
              label={f.description}
              value={text(f)}
              help={help}
              className={styles.readonlyField}
            />
          );
        })}
      </section>
    );
  return (
    <section
      id={id}
      className={
        displayOnly ? styles.viewPanel : plain ? styles.plain : styles.panel
      }
      aria-label="Attributes"
    >
      {fields.map((f) => {
        const fieldId = `${id}-${functions.ids.idPart(f.name)}`,
          message = errors[f.name],
          shownError =
            message !== undefined && (checked || touched.has(f.name));
        if (displayOnly)
          return (
            <div id={fieldId} key={f.name} className={styles.viewField}>
              <div className={styles.viewLabel}>
                <span>{f.description}</span>
                <HelpButton
                  id={`${fieldId}-help`}
                  html={f.helperText}
                  label={data.texts.moreInfo}
                />
              </div>
              <div className={styles.viewValue}>
                {values[f.name] === null || values[f.name] === undefined
                  ? ""
                  : String(values[f.name])}
              </div>
            </div>
          );
        return (
          <div
            key={f.name}
            className={styles.cell}
            style={{ width: fieldWidth(f.colspan, COLUMNS) }}
          >
            <div className={styles.row}>
              {control(f, fieldId, shownError)}
              <HelpButton
                id={`${fieldId}-help`}
                html={f.helperText}
                label={data.texts.moreInfo}
              />
            </div>
            {shownError && (
              <span
                id={`${fieldId}-error`}
                className={styles.error}
                role="alert"
              >
                {message}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
