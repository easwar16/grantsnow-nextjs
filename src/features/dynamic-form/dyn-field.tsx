"use client";
import { DateInput } from "@/components/ui/date-input";
import { idPart } from "@/lib/ids";
import { useState } from "react";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { MultiSelect } from "@/components/ui/multi-select";
import { RichText } from "@/components/ui/rich-text";
import { fileNameOf, isBlank, optionsFor, roundTo } from "./engine";
import type { DynamicFormModel } from "./model";
import type {
  DynamicFormData,
  DynField,
  DynSection,
  FieldValue,
} from "./models";
import styles from "./dynamic-form.module.css";
/**
 * A number box that keeps what is typed ("1.") while the model holds a number or nothing; an empty number stays
 * empty (D42). Rounded to DECIMAL_PLACES_COUNT when the field is left.
 */
export function NumberInput({
  value,
  onChange,
  onBlur,
  decimals,
  ...rest
}: {
  value: FieldValue;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  decimals: number;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
>) {
  const asText = typeof value === "number" ? String(value) : "",
    [text, setText] = useState(asText),
    [held, setHeld] = useState(value);
  // A value set from outside (a reload, a rounding) replaces the typed text.
  if (held !== value) {
    setHeld(value);
    if (text === "" ? value !== null : Number(text) !== value) setText(asText);
  }
  return (
    <input
      {...rest}
      type="number"
      step="any"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value === "" ? null : Number(e.target.value);
        onChange(n === null || Number.isFinite(n) ? n : null);
      }}
      onBlur={() => {
        if (typeof value === "number") {
          const rounded = roundTo(value, decimals);
          if (rounded !== value) onChange(rounded);
        }
        onBlur?.();
      }}
    />
  );
}
const LABELLED_TYPES = ["TEXTBOX", "TEXTFIELD", "NUMERIC", "DATE"];
/** One FORM field: label, More Info, the input for its type, and its error (port of GN-Angular dyn-field). */
export function DynFieldView({
  model,
  formId,
  section,
  field,
  id,
  data,
  busy,
  onPick,
  onDownload,
}: {
  model: DynamicFormModel;
  formId: number;
  section: DynSection;
  field: DynField;
  id: string;
  data: DynamicFormData;
  busy: boolean;
  onPick: (file: File) => void;
  onDownload: () => void;
}) {
  const sectionId = section.sectionId,
    fieldId = field.fieldId,
    value = model.value(formId, sectionId, fieldId),
    live = model.live(formId, sectionId, fieldId),
    required = model.required(formId, sectionId, fieldId),
    error = model.error(formId, sectionId, fieldId),
    errorId = `${id}-error`,
    { texts, settings } = data,
    [dragging, setDragging] = useState(false);
  const set = (v: FieldValue) => model.setValue(formId, sectionId, fieldId, v);
  const touch = () => model.touch(formId, sectionId, fieldId);
  const parent = field.parent_header_attr;
  const options = optionsFor(
    field,
    isBlank(parent) ? null : model.value(formId, sectionId, Number(parent)),
  );
  const list = Array.isArray(value) ? value : [];
  const chosenLabels = () => {
    const chosen = Array.isArray(value) ? value : [String(value ?? "")];
    return options
      .filter((o) => chosen.includes(String(o.optionId)))
      .map((o) => o.optionValue)
      .join(", ");
  };
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "aria-required": required || undefined,
  } as const;
  // A <label for> only where the id is on a native input; groups, rich text, files and read-only text are named by id.
  const labelsInput =
    LABELLED_TYPES.includes(field.fieldType) ||
    (field.fieldType === "LOV" && live);
  const label = (
    <>
      {field.description}
      {required && <span aria-hidden="true"> *</span>}
    </>
  );
  const control = () => {
    switch (field.fieldType) {
      case "RICHTEXTEDITOR":
        return (
          <RichText
            id={id}
            value={typeof value === "string" ? value : null}
            onChange={set}
            onBlur={touch}
            label={field.description}
            invalid={error !== null}
            readOnly={!live}
            disabled={busy}
            texts={{
              sourceCode: texts.sourceCode,
              cancel: texts.cancel,
              done: texts.done,
            }}
          />
        );
      case "NUMERIC":
        return (
          <NumberInput
            id={id}
            className="gn-control"
            value={value}
            decimals={settings.decimals}
            disabled={!live}
            onChange={set}
            onBlur={touch}
            {...aria}
          />
        );
      case "DATE":
        return (
          <DateInput
            id={id}
            value={typeof value === "string" ? value : ""}
            disabled={!live}
            required={required}
            invalid={!!error}
            describedBy={error ? errorId : undefined}
            onChange={(date) => set(date === "" ? null : date)}
            onBlur={touch}
          />
        );
      case "RADIO":
        return (
          <div
            className={styles.choices}
            role="radiogroup"
            aria-labelledby={`${id}-label`}
            {...aria}
          >
            {options.map((o) => (
              <label key={o.optionId} className={styles.choice}>
                <input
                  id={`${id}-option-${idPart(o.optionId)}`}
                  type="radio"
                  name={id}
                  checked={value === String(o.optionId)}
                  disabled={!live}
                  onChange={() => set(String(o.optionId))}
                  onBlur={touch}
                />
                {o.optionValue}
              </label>
            ))}
          </div>
        );
      case "CHECKBOX":
      case "CHECKLIST":
        return (
          <div
            className={styles.choices}
            role="group"
            aria-labelledby={`${id}-label`}
            {...aria}
          >
            {options.map((o) => {
              const optionId = String(o.optionId);
              return (
                <label key={optionId} className={styles.choice}>
                  <input
                    id={`${id}-option-${idPart(optionId)}`}
                    type="checkbox"
                    checked={list.includes(optionId)}
                    disabled={!live}
                    onChange={(e) =>
                      set(
                        e.target.checked
                          ? [...list, optionId]
                          : list.filter((v) => v !== optionId),
                      )
                    }
                    onBlur={touch}
                  />
                  {o.optionValue}
                </label>
              );
            })}
          </div>
        );
      case "LOV":
        return !live ? (
          <span id={id} className={styles.readOnly}>
            {chosenLabels()}
          </span>
        ) : (
          <select
            id={id}
            className="gn-control"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => set(e.target.value === "" ? null : e.target.value)}
            onBlur={touch}
            {...aria}
          >
            <option value="" />
            {options.map((o) => (
              <option key={o.optionId} value={String(o.optionId)}>
                {o.optionValue}
              </option>
            ))}
          </select>
        );
      case "COMBOBOXMANY":
        return !live ? (
          <span id={id} className={styles.readOnly}>
            {chosenLabels()}
          </span>
        ) : (
          <div {...aria} onBlur={touch}>
            <MultiSelect
              id={id}
              label={field.description}
              options={options.map((o) => ({
                value: String(o.optionId),
                label: o.optionValue,
              }))}
              value={list}
              onChange={(next) => {
                set(next);
                touch();
              }}
            />
          </div>
        );
      case "FILE":
        return fileControl();
      default:
        return (
          <input
            id={id}
            className="gn-control"
            type="text"
            value={typeof value === "string" ? value : ""}
            disabled={!live}
            onChange={(e) => set(e.target.value)}
            onBlur={touch}
            {...aria}
          />
        );
    }
  };
  const fileControl = () => {
    const name = fileNameOf(value);
    const storageOff = !settings.storage;
    const accept = (picked: File | undefined) => {
      if (picked && live && !storageOff) onPick(picked);
    };
    return (
      <div
        className={`${styles.file} ${dragging ? styles.dragging : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(live && !storageOff);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        {name !== "" ? (
          <>
            <Icon name="attachment" size={14} />
            <span id={id} className={styles.fileName}>
              {name}
            </span>
            <button
              id={`${id}-download`}
              type="button"
              className="gn-btn gn-btn--borderless gn-btn--icon"
              title={texts.download}
              aria-label={`${texts.download} ${name}`}
              disabled={
                storageOff &&
                model.pendingFile(formId, sectionId, fieldId) === null
              }
              onClick={onDownload}
            >
              <Icon name="download" size={14} />
            </button>
            {live && (
              <button
                id={`${id}-delete`}
                type="button"
                className="gn-btn gn-btn--borderless gn-btn--icon"
                title={texts.delete}
                aria-label={`${texts.delete} ${name}`}
                disabled={storageOff}
                onClick={() => model.removeFile(formId, sectionId, fieldId)}
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </>
        ) : !live ? (
          <span id={id} className={styles.readOnly}>
            {texts.noFile}
          </span>
        ) : (
          <label
            className={`gn-btn gn-btn--outlined ${styles.pick} ${storageOff ? styles.pickOff : ""}`}
          >
            <Icon name="attachment" size={14} />
            {texts.dragAndDrop}
            <input
              id={id}
              type="file"
              className="sr-only"
              accept={settings.accept || undefined}
              disabled={storageOff}
              {...aria}
              onChange={(e) => {
                accept(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {storageOff && (
          <span className={styles.storageOff}>{texts.storageOff}</span>
        )}
      </div>
    );
  };
  return (
    <div className={`gn-field ${styles.field} ${error ? styles.invalid : ""}`}>
      <span className={styles.labelRow}>
        {labelsInput ? (
          <label className="gn-label" htmlFor={id} id={`${id}-label`}>
            {label}
          </label>
        ) : (
          <span className="gn-label" id={`${id}-label`}>
            {label}
          </span>
        )}
        <HelpButton
          id={`${id}-help`}
          html={field.helperText}
          label={texts.moreInfo}
        />
      </span>
      {control()}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
