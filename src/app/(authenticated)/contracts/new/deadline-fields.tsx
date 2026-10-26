"use client";
import { useRef, useState } from "react";

type Choice = { value: string; label: string };
type Deadline = {
  deadline_type: string;
  deadline_description: string;
  deadline_date: string;
  reminder_days: number | null;
};

export function DeadlineFields({ types }: { types: Choice[] }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [draft, setDraft] = useState({
    deadline_type: "",
    deadline_description: "",
    deadline_date: "",
    reminder_days: "",
  });
  const dialog = useRef<HTMLDialogElement>(null);
  function add() {
    const controls = dialog.current?.querySelectorAll(
      "input, select, textarea",
    );
    if (
      !controls ||
      ![...controls].every((control) =>
        (control as HTMLInputElement).reportValidity(),
      )
    )
      return;
    const row: Deadline = {
      deadline_type: draft.deadline_type,
      deadline_description: draft.deadline_description,
      deadline_date: draft.deadline_date,
      reminder_days: draft.reminder_days ? Number(draft.reminder_days) : null,
    };
    if (
      !types.some((item) => item.value === row.deadline_type) ||
      !row.deadline_date
    )
      return;
    setDeadlines((current) =>
      [...current, row].sort((a, b) =>
        a.deadline_date.localeCompare(b.deadline_date),
      ),
    );
    setDraft({
      deadline_type: "",
      deadline_description: "",
      deadline_date: "",
      reminder_days: "",
    });
    dialog.current?.close();
  }
  return (
    <>
      <div className="contract-deadline-toolbar">
        <h2>Deadline Date</h2>
        <button type="button" onClick={() => dialog.current?.showModal()}>
          Add Deadline Date
        </button>
      </div>
      <div
        className="contract-deadline-table"
        role="table"
        aria-label="Contract deadlines"
      >
        <div role="row" className="contract-deadline-head">
          <span role="columnheader">Deadline Type</span>
          <span role="columnheader">Deadline Description</span>
          <span role="columnheader">Deadline date</span>
          <span role="columnheader">Remind me before</span>
          <span role="columnheader" className="sr-only">
            Actions
          </span>
        </div>
        {deadlines.length === 0 ? (
          <p>No data to display.</p>
        ) : (
          deadlines.map((row, index) => (
            <div
              role="row"
              key={`${row.deadline_type}-${row.deadline_date}-${index}`}
              className="contract-deadline-row"
            >
              <span role="cell">
                {types.find((item) => item.value === row.deadline_type)?.label}
              </span>
              <span role="cell">{row.deadline_description}</span>
              <span role="cell">{row.deadline_date}</span>
              <span role="cell">{row.reminder_days ?? ""}</span>
              <button
                type="button"
                aria-label={`Remove deadline ${index + 1}`}
                onClick={() =>
                  setDeadlines((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
      <input
        type="hidden"
        name="contract_deadlines"
        value={JSON.stringify(
          deadlines.map((row) => ({
            ...row,
            deadline_date: `${row.deadline_date}T00:00:00`,
          })),
        )}
      />
      <dialog ref={dialog} aria-labelledby="deadline-dialog-title">
        <h2 id="deadline-dialog-title">Add new Deadline</h2>
        <div className="contract-deadline-dialog-fields">
          <label>
            Deadline Type *
            <select
              required
              value={draft.deadline_type}
              onChange={(event) =>
                setDraft({ ...draft, deadline_type: event.target.value })
              }
            >
              <option value="">Select Deadline Type</option>
              {types.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline Date *
            <input
              type="date"
              required
              disabled={!draft.deadline_type}
              value={draft.deadline_date}
              onChange={(event) =>
                setDraft({ ...draft, deadline_date: event.target.value })
              }
            />
          </label>
          <label>
            Remind me before (days)
            <input
              type="number"
              min="1"
              step="1"
              value={draft.reminder_days}
              onChange={(event) =>
                setDraft({ ...draft, reminder_days: event.target.value })
              }
            />
          </label>
          <label>
            Deadline Description
            <textarea
              maxLength={1000}
              value={draft.deadline_description}
              onChange={(event) =>
                setDraft({ ...draft, deadline_description: event.target.value })
              }
            />
          </label>
          <div>
            <button type="button" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="button" onClick={add}>
              Add
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
