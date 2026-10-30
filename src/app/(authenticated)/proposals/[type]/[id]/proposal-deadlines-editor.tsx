"use client";
import { functions } from "@/lib/functions";
import { useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
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
      <table>
        <thead>
          <tr>
            <th scope="col">Deadline type</th>
            <th scope="col">Deadline Description</th>
            <th scope="col">Deadline Date</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.summaryEmpty}>
                {noData}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={`${row.id ?? "new"}-${index}`}
                id={`proposal-${id}-deadline-${row.id ?? index}`}
              >
                <td>
                  {types.find((type) => type.value === row.type)?.label ??
                    row.type}
                </td>
                <td>{row.description}</td>
                <td>
                  {row.date
                    ? functions.format.dateDisplay(row.date, format)
                    : ""}
                </td>
                <td className={styles.summaryRowActions}>
                  <button
                    type="button"
                    aria-label={`Edit deadline ${index + 1}`}
                    onClick={() => open(index)}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete deadline ${index + 1}`}
                    onClick={() =>
                      setRows((current) =>
                        current.filter((_, at) => at !== index),
                      )
                    }
                  >
                    <Icon name="trash" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {editing !== null && (
        <div className={styles.editDialogBackdrop}>
          <div
            className={styles.editDialog}
            role="dialog"
            aria-modal="true"
            aria-label={editing === -1 ? "Add Deadline Date" : "Edit Deadline"}
          >
            <h2>{editing === -1 ? "Add Deadline Date" : "Edit Deadline"}</h2>
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
                type="button"
                className={styles.actionButton}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.actionButton}
                disabled={!draft.type || (draft.type !== "NONE" && !draft.date)}
                onClick={commit}
              >
                {editing === -1 ? "Add" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
