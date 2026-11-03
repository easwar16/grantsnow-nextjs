"use client";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
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
import { functions } from "@/lib/functions";
/** What a cell shows outside edit mode: an LOV's option label, a date as configured, else the value. */
function cellText(field: DynField, value: FieldValue): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.fieldType === "LOV")
    return (
      field.options?.find((o) => String(o.optionId) === String(value))
        ?.optionValue ?? String(value)
    );
  if (field.fieldType === "DATE" && typeof value === "string")
    return functions.format.dateDisplay(value) ?? value;
  return Array.isArray(value) ? value.join(", ") : String(value);
}
/**
 * A GRID section (port of GN-Angular dyn-grid): a table, one row edited at a time (Insert Row, Edit, Delete; Done,
 * Cancel). Columns are keyed by field id and labelled by the field's description.
 */
/** A grid row with its position, which the row's actions and labels name. */
type GridRow = {
  row: Record<string, FieldValue>;
  i: number;
  editing: boolean;
};
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
      <div className={`gn-table-scroll ${styles.tableWrap}`}>
        <DataTable
          id={`${id}-table`}
          rowIds={`${id}-row`}
          className={styles.table}
          columns={section.fields.map((f) => ({
            id: String(f.fieldId),
            header: (
              <>
                {f.description}
                {f.isRequired === "Y" && <span aria-hidden="true"> *</span>}
              </>
            ),
            cell: ({ row, editing }: GridRow) => {
              const value = row[String(f.fieldId)] ?? null;
              return editing && isGridEditable(f)
                ? editor(f, value)
                : cellText(f, value);
            },
          }))}
          rows={rows.map((row, i) => ({
            row,
            i,
            editing: model.isEditingRow(formId, section.sectionId, i),
          }))}
          rowKey={(r) => String(r.i)}
          rowClassName={(r) => (r.editing ? styles.editing : undefined)}
          actions={
            editable
              ? [
                  {
                    id: "done",
                    icon: "success",
                    size: 14,
                    label: () => texts.done,
                    hidden: (r) => !r.editing,
                    onClick: () => model.doneRow(),
                  },
                  {
                    id: "cancel",
                    icon: "close",
                    size: 14,
                    label: () => texts.cancel,
                    hidden: (r) => !r.editing,
                    onClick: () => model.cancelRow(),
                  },
                  {
                    id: "edit",
                    icon: "pen",
                    size: 14,
                    label: (r) => `${texts.edit} row ${r.i + 1}`,
                    title: texts.edit,
                    hidden: (r) => r.editing,
                    disabled: () => busy,
                    onClick: (r) => model.editRow(formId, section, r.i),
                  },
                  {
                    id: "delete",
                    icon: "trash",
                    size: 14,
                    label: (r) => `${texts.delete} row ${r.i + 1}`,
                    title: texts.delete,
                    hidden: (r) => r.editing,
                    disabled: () => busy,
                    onClick: (r) => model.deleteRow(formId, section, r.i),
                  },
                ]
              : []
          }
          actionsClassName={styles.actionsCol}
          empty={texts.noData}
        />
      </div>
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          Fill in the required columns of every row.
        </span>
      )}
    </div>
  );
}
