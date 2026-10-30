"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import type { SummaryField } from "@/features/modules/proposals/record";
import styles from "./proposal-record.module.css";

type Candidate = {
  personId: number;
  employeeNumber: string | number;
  name: string;
  orgUnitId: number;
  orgUnitName: string;
};

export function ProposalPiEditor({
  id,
  fields,
  initialPersonId,
  candidates,
}: {
  id: string;
  fields: SummaryField[];
  initialPersonId: number | null;
  candidates: Candidate[];
}) {
  const [selected, setSelected] = useState(initialPersonId);
  const [draft, setDraft] = useState(initialPersonId);
  const [open, setOpen] = useState(false);
  const [orgUnit, setOrgUnit] = useState("");
  const [search, setSearch] = useState("");
  const chosen = candidates.find(
    (candidate) => candidate.personId === selected,
  );
  const filtered = candidates.filter(
    (candidate) =>
      (!orgUnit || String(candidate.orgUnitId) === orgUnit) &&
      candidate.name.toLowerCase().includes(search.toLowerCase()),
  );
  const units = Array.from(
    new Map(
      candidates.map((candidate) => [
        candidate.orgUnitId,
        candidate.orgUnitName,
      ]),
    ),
  ).map(([value, label]) => ({ value: String(value), label }));
  return (
    <div id={`proposal-${id}-pi-editor`} className={styles.piEditor}>
      <div className={styles.summaryPi}>
        <div className={styles.summaryFieldList}>
          {fields.map((field) => (
            <div id={`proposal-${id}-pi-${field.key}`} key={field.key}>
              <strong>{field.label}</strong>
              <div>
                {chosen
                  ? field.key === "full-name"
                    ? chosen.name
                    : field.key === "employee-number"
                      ? chosen.employeeNumber
                      : field.key === "org-unit"
                        ? chosen.orgUnitName
                        : field.value
                  : field.value}
              </div>
            </div>
          ))}
        </div>
      </div>
      <input
        type="hidden"
        name="piPersonId"
        form={`proposal-${id}-edit-form`}
        value={selected ?? ""}
        readOnly
      />
      <button
        id={`proposal-${id}-change-pi`}
        type="button"
        className={styles.piAction}
        onClick={() => {
          setDraft(null);
          setOrgUnit("");
          setSearch("");
          setOpen(true);
        }}
      >
        <Icon name="account" /> Change PI
      </button>
      {open && (
        <ActionDialog
          id={`proposal-${id}-pi-dialog`}
          title="Search for Principal Investigator"
          width="50vw"
          className={styles.piDialog}
          onClose={() => setOpen(false)}
        >
          <div className={styles.piSearch}>
            <Select
              id={`proposal-${id}-pi-org-unit`}
              label="Filter by Org Unit"
              placeholder="Filter by Org Unit"
              options={units}
              value={orgUnit}
              onChange={setOrgUnit}
            />
            <input
              id={`proposal-${id}-pi-search`}
              type="search"
              aria-label="Search"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              id={`proposal-${id}-pi-clear`}
              type="button"
              className={styles.piClear}
              onClick={() => {
                setOrgUnit("");
                setSearch("");
              }}
            >
              <Icon name="close-circle" /> Clear
            </button>
          </div>
          <fieldset id={`proposal-${id}-pi-list`} className={styles.piList}>
            <legend>Principal Investigators</legend>
            {filtered.length === 0 && <p>No items to display</p>}
            {filtered.map((candidate) => (
              <label
                id={`proposal-${id}-pi-candidate-${candidate.personId}`}
                key={candidate.personId}
                className={
                  draft === candidate.personId ? styles.piSelected : ""
                }
              >
                <input
                  id={`proposal-${id}-pi-candidate-${candidate.personId}-choice`}
                  type="radio"
                  name={`proposal-${id}-pi-choice`}
                  checked={draft === candidate.personId}
                  onChange={() => setDraft(candidate.personId)}
                />
                <span>{candidate.name}</span>
                <small>{candidate.orgUnitName}</small>
              </label>
            ))}
          </fieldset>
          <div className={styles.piFooter}>
            <button
              id={`proposal-${id}-pi-okay`}
              type="button"
              className="gn-btn gn-btn--primary"
              onClick={() => {
                if (draft === null) return;
                setSelected(draft);
                setOpen(false);
              }}
            >
              Okay
            </button>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
