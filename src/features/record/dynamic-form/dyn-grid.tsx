"use client";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { dateDisplay } from "@/lib/format";
import { isGridEditable, sectionKey } from "./engine";
import type { DynamicFormModel } from "./model";
import type {
  DynamicFormData,
  DynField,
  DynSection,
  FieldValue,
} from "./models";
import { NumberInput } from "./dyn-field";
import styles from "./dynamic-form.module.css";
/** What a cell shows outside edit mode: an LOV's option label, a date as configured, else the value. */
function cellText(field: DynField, value: FieldValue): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.fieldType === "LOV")
    return (
      field.options?.find((o) => String(o.optionId) === String(value))
        ?.optionValue ?? String(value)
    );
  if (field.fieldType === "DATE" && typeof value === "string")
    return dateDisplay(value) ?? value;
  return Array.isArray(value) ? value.join(", ") : String(value);
}
/**
 * A GRID section (port of GN-Angular dyn-grid): a table, one row edited at a time (Insert Row, Edit, Delete; Done,
 * Cancel). Columns are keyed by field id and labelled by the field's description.
 */
export function DynGrid({
  id,
  model,
  formId,
  section,
  texts,
  decimals,
}: {
  id: string;
  model: DynamicFormModel;
  formId: number;
  section: DynSection;
  texts: DynamicFormData["texts"];
  decimals: number;
}) {
  const rows = model.rows(formId, section.sectionId),
    editable = model.isEditable,
    busy = model.rowEdit !== null,
    error = model.gridErrors.has(sectionKey(formId, section.sectionId));
  const editor = (f: DynField, value: FieldValue) => {
    const problem = model.cellError(f.fieldId);
    // One row is edited at a time, so a cell editor is unique per column.
    const common = {
      id: `${id}-cell-${f.fieldId}`,
      className: `gn-control ${problem ? styles.bad : ""}`,
      "aria-label": f.description,
      "aria-invalid": problem ? true : undefined,
    } as const;
    const control =
      f.fieldType === "NUMERIC" ? (
        <NumberInput
          {...common}
          value={value}
          decimals={decimals}
          onChange={(v) => model.setCell(f.fieldId, v)}
        />
      ) : f.fieldType === "DATE" ? (
        <DateInput
          id={common.id}
          label={f.description}
          invalid={!!problem}
          value={typeof value === "string" ? value : ""}
          onChange={(date) =>
            model.setCell(f.fieldId, date === "" ? null : date)
          }
        />
      ) : f.fieldType === "LOV" ? (
        <Select
          id={common.id}
          label={f.description}
          options={(f.options ?? []).map((o) => ({
            value: String(o.optionId),
            label: o.optionValue,
          }))}
          value={typeof value === "string" ? value : ""}
          invalid={!!problem}
          onChange={(next) =>
            model.setCell(f.fieldId, next === "" ? null : next)
          }
        />
      ) : (
        <input
          {...common}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => model.setCell(f.fieldId, e.target.value)}
        />
      );
    return (
      <>
        {control}
        {problem && <span className={styles.cellError}>{problem}</span>}
      </>
    );
  };
  return (
    <div id={id} className={styles.grid}>
      {editable && (
        <div className={styles.gridTools}>
          <button
            id={`${id}-insert`}
            type="button"
            className="gn-btn gn-btn--primary"
            disabled={busy}
            onClick={() => model.addRow(formId, section)}
          >
            <Icon name="plus" size={14} />
            {texts.insertRow}
          </button>
        </div>
      )}
      <div className={styles.tableWrap}>
        <table id={`${id}-table`} className={styles.table}>
          <thead>
            <tr>
              {section.fields.map((f) => (
                <th key={f.fieldId} scope="col">
                  {f.description}
                  {f.isRequired === "Y" && <span aria-hidden="true"> *</span>}
                </th>
              ))}
              {editable && (
                <th scope="col" className={styles.actionsCol}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className={styles.gridEmpty}
                  colSpan={section.fields.length + (editable ? 1 : 0)}
                >
                  {texts.noData}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const editing = model.isEditingRow(
                  formId,
                  section.sectionId,
                  i,
                );
                return (
                  <tr key={i} className={editing ? styles.editing : undefined}>
                    {section.fields.map((f) => {
                      const value = row[String(f.fieldId)] ?? null;
                      return (
                        <td key={f.fieldId}>
                          {editing && isGridEditable(f)
                            ? editor(f, value)
                            : cellText(f, value)}
                        </td>
                      );
                    })}
                    {editable && (
                      <td className={styles.actionsCol}>
                        {editing ? (
                          <>
                            <button
                              id={`${id}-done`}
                              type="button"
                              className="gn-btn gn-btn--borderless gn-btn--icon"
                              title={texts.done}
                              aria-label={texts.done}
                              onClick={() => model.doneRow()}
                            >
                              <Icon name="success" size={14} />
                            </button>
                            <button
                              id={`${id}-cancel`}
                              type="button"
                              className="gn-btn gn-btn--borderless gn-btn--icon"
                              title={texts.cancel}
                              aria-label={texts.cancel}
                              onClick={() => model.cancelRow()}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="gn-btn gn-btn--borderless gn-btn--icon"
                              disabled={busy}
                              title={texts.edit}
                              aria-label={`${texts.edit} row ${i + 1}`}
                              onClick={() => model.editRow(formId, section, i)}
                            >
                              <Icon name="pen" size={14} />
                            </button>
                            <button
                              type="button"
                              className="gn-btn gn-btn--borderless gn-btn--icon"
                              disabled={busy}
                              title={texts.delete}
                              aria-label={`${texts.delete} row ${i + 1}`}
                              onClick={() =>
                                model.deleteRow(formId, section, i)
                              }
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          Fill in the required columns of every row.
        </span>
      )}
    </div>
  );
}
