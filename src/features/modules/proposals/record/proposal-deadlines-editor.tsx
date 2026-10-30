"use client";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { functions } from "@/lib/functions";
import { useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { Select, type SelectOption } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { useFormat } from "@/components/layout/shell-context";
import styles from "./proposal-record.module.css";

type Deadline = {
  id: number | null;
  type: string;
  date: string | null;
  description: string;
};
export function ProposalDeadlinesEditor({
  id,
  initial,
  types,
  noData,
}: {
  id: string;
  initial: Deadline[];
  types: SelectOption[];
  noData: string;
}) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Deadline>({
    id: null,
    type: "",
    date: null,
    description: "",
  });
  const format = useFormat();
  const open = (index: number | null) => {
    setEditing(index === null ? -1 : index);
    setDraft(
      index === null
        ? { id: null, type: "", date: null, description: "" }
        : rows[index],
    );
  };
  const commit = () => {
    if (!draft.type || (draft.type !== "NONE" && !draft.date)) return;
    setRows((current) =>
      editing === -1
        ? [...current, draft]
        : current.map((row, index) => (index === editing ? draft : row)),
    );
    setEditing(null);
  };
  return (
    <div id={`proposal-${id}-deadline-editor`}>
      <div className={styles.deadlineHeading}>
        <h2>Deadline date</h2>
        <button
          id={`proposal-${id}-add-deadline`}
          type="button"
          className={styles.actionButton}
          onClick={() => open(null)}
        >
          Add Deadline Date
        </button>
      </div>
      <input
        type="hidden"
        name="deadlines"
        form={`proposal-${id}-edit-form`}
        value={JSON.stringify(rows)}
        readOnly
      />
      <DataTable
        id={`proposal-${id}-deadlines-table`}
        rowIds={`proposal-${id}-deadline`}
        columns={[
          {
            id: "type",
            header: "Deadline type",
            cell: (row) =>
              types.find((type) => type.value === row.type)?.label ?? row.type,
          },
          {
            id: "description",
            header: "Deadline Description",
            cell: (row) => row.description,
          },
          {
            id: "date",
            header: "Deadline Date",
            cell: (row) =>
              row.date ? functions.format.dateDisplay(row.date, format) : "",
          },
        ]}
        rows={rows}
        rowKey={(row) => String(row.id ?? rows.indexOf(row))}
        actionsLabel="Actions"
        actionsClassName={styles.summaryRowActions}
        actions={[
          {
            id: "edit",
            icon: "edit",
            label: (row) => `Edit deadline ${rows.indexOf(row) + 1}`,
            onClick: (row) => open(rows.indexOf(row)),
          },
          {
            id: "delete",
            icon: "trash",
            label: (row) => `Delete deadline ${rows.indexOf(row) + 1}`,
            onClick: (row) => {
              const index = rows.indexOf(row);
              setRows((current) => current.filter((_, at) => at !== index));
            },
          },
        ]}
        empty={<span className={styles.summaryEmpty}>{noData}</span>}
      />
      {editing !== null && (
        <ActionDialog
          id={`proposal-${id}-deadline-dialog`}
          title={editing === -1 ? "Add Deadline Date" : "Edit Deadline"}
          onClose={() => setEditing(null)}
        >
          <div className={styles.editBody}>
            <label>
              Deadline type
              <Select
                id={`proposal-${id}-deadline-type`}
                label="Deadline type"
                options={types}
                value={draft.type}
                onChange={(type) =>
                  setDraft((current) => ({ ...current, type }))
                }
              />
            </label>
            <label>
              Deadline date
              <DateInput
                id={`proposal-${id}-deadline-date-input`}
                label="Deadline date"
                value={draft.date ?? ""}
                onChange={(date) =>
                  setDraft((current) => ({ ...current, date: date || null }))
                }
                disabled={!draft.type || draft.type === "NONE"}
                required={draft.type !== "NONE"}
              />
            </label>
            <label>
              Deadline Description
              <textarea
                id={`proposal-${id}-deadline-description`}
                value={draft.description}
                maxLength={1000}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className={styles.editDialogActions}>
              <button
                id={`proposal-${id}-deadline-cancel`}
                type="button"
                className={styles.actionButton}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                id={`proposal-${id}-deadline-done`}
                type="button"
                className={styles.actionButton}
                disabled={!draft.type || (draft.type !== "NONE" && !draft.date)}
                onClick={commit}
              >
                {editing === -1 ? "Add" : "Done"}
              </button>
            </div>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
