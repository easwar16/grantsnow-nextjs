"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { DateInput } from "@/components/ui/date-input";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { proposals } from "@/lib/api";
import type { staffEntryOptions } from "@/server/modules/proposals/staff-entry";
import styles from "../proposal-record.module.css";

type Options = Awaited<ReturnType<typeof staffEntryOptions>>;
type Detail =
  Awaited<ReturnType<typeof proposals.staffEntryPerson>> extends {
    ok: true;
    data: infer T;
  }
    ? T
    : {
        personId: number;
        name: string;
        employeeNumber: string;
        orgUnitId: number;
        orgUnitName: string;
        faculty: string;
        probationEndDate: string;
        firstIncrement: string;
        projectRole: string;
        fundingSection: string;
        salaryModel: string;
        hrFte: string;
      };
type Line = {
  id: number;
  startDate: string;
  endDate: string;
  unitType: string;
  units: string;
  baseline: string;
  unindexed: string;
  total: string;
};
type Availability = {
  startDate: string;
  endDate: string;
  items: {
    proposalNumber: string;
    startDate: string;
    endDate: string;
    fte: number;
  }[];
};
const names = {
  staff: "Staff costing",
  student: "Student Cost",
  "pool-tech": "Pooled Technician Cost",
} as const;
const incrementMonths = Array.from({ length: 11 * 12 }, (_, index) => {
  const month = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ][index % 12];
  const value = `${month}-${2025 + Math.floor(index / 12)}`;
  return { value, label: value };
});

export function StaffEntry({
  id,
  type,
  options,
}: {
  id: string;
  type: string;
  options: Options;
}) {
  const router = useRouter();
  const requestEpoch = useRef(0);
  const kind = options.kind;
  const budget = `/proposals/${type}/${id}/budget`;
  const [search, setSearch] = useState("");
  const [showStaffOptions, setShowStaffOptions] = useState(false);
  const [person, setPerson] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [orgUnitId, setOrgUnitId] = useState<number | null>(null);
  const [projectRole, setProjectRole] = useState(options.defaultRole);
  const [section, setSection] = useState(options.defaultSection);
  const [salaryModel, setSalaryModel] = useState(options.defaultSalaryModel);
  const [probationEndDate, setProbationEndDate] = useState("");
  const [firstIncrement, setFirstIncrement] = useState("");
  const [hrFte, setHrFte] = useState("");
  const [overrideInflation, setOverrideInflation] = useState(false);
  const [inflationRate, setInflationRate] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<{
    costHeaderId: number;
    lines: Line[];
  } | null>(null);
  const [editLine, setEditLine] = useState<Line | null>(null);
  const [baselineEdited, setBaselineEdited] = useState<number[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const filtered = options.people
    .filter(
      (item) =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.employeeNumber.includes(search),
    )
    .slice(0, 12);
  const selectPerson = async (personId: number) => {
    if (person?.personId === personId) {
      setSearch("");
      setShowStaffOptions(false);
      return;
    }
    setBusy(true);
    setError("");
    setSearch("");
    setShowStaffOptions(false);
    const epoch = ++requestEpoch.current;
    const result = await proposals.staffEntryPerson(type, id, personId);
    if (epoch !== requestEpoch.current) return;
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const detail = result.data;
    setCost(null);
    setEditLine(null);
    setBaselineEdited([]);
    setAvailability(null);
    setAvailabilityBusy(false);
    setPerson(detail);
    setName(detail.name);
    setOrgUnitId(detail.orgUnitId);
    setProjectRole(detail.projectRole);
    setSection(detail.fundingSection);
    setSalaryModel(detail.salaryModel);
    setProbationEndDate(detail.probationEndDate);
    setFirstIncrement(
      Number(detail.employeeNumber) === 0 &&
        !incrementMonths.some((month) => month.value === detail.firstIncrement)
        ? ""
        : detail.firstIncrement,
    );
    setHrFte(detail.hrFte);
    setOverrideInflation(false);
    setInflationRate("");
    setAnswers({});
  };
  const reset = () => {
    setName(person?.name ?? "");
    setOrgUnitId(person?.orgUnitId ?? null);
    setProjectRole(person?.projectRole ?? options.defaultRole);
    setSection(person?.fundingSection ?? options.defaultSection);
    setSalaryModel(person?.salaryModel ?? options.defaultSalaryModel);
    setProbationEndDate(person?.probationEndDate ?? "");
    setFirstIncrement(
      person &&
        Number(person.employeeNumber) === 0 &&
        !incrementMonths.some((month) => month.value === person.firstIncrement)
        ? ""
        : (person?.firstIncrement ?? ""),
    );
    setHrFte(person?.hrFte ?? "");
    setOverrideInflation(false);
    setInflationRate("");
    setAnswers({});
    setError("");
  };
  const startNewCost = () => {
    requestEpoch.current += 1;
    setSearch("");
    setShowStaffOptions(false);
    setPerson(null);
    setBusy(false);
    setError("");
    setName("");
    setStudentNumber("");
    setOrgUnitId(null);
    setProjectRole(options.defaultRole);
    setSection(options.defaultSection);
    setSalaryModel(options.defaultSalaryModel);
    setProbationEndDate("");
    setFirstIncrement("");
    setHrFte("");
    setOverrideInflation(false);
    setInflationRate("");
    setAnswers({});
    setCost(null);
    setEditLine(null);
    setBaselineEdited([]);
    setAvailability(null);
    setAvailabilityBusy(false);
    router.refresh();
  };
  const openAvailability = async () => {
    if (!person || availabilityBusy) return;
    const epoch = requestEpoch.current;
    setAvailabilityBusy(true);
    setError("");
    const result = await proposals.staffEntryAvailability(
      type,
      id,
      person.personId,
    );
    if (epoch !== requestEpoch.current) return;
    setAvailabilityBusy(false);
    if (!result.ok) {
      setError("Error Occured");
      return;
    }
    if (result.data.items.length === 0) {
      setError("No Relevant Staff Data Found");
      return;
    }
    setAvailability(result.data);
  };
  const getLines = async () => {
    if (busy || cost) return;
    if (!name.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!projectRole) {
      setError("Project role is required.");
      return;
    }
    if (!section) {
      setError("Costing HDR section is required.");
      return;
    }
    if (!salaryModel) {
      setError("Salary Model is required.");
      return;
    }
    if (kind === "staff" && !person) {
      setError("Select a staff person.");
      return;
    }
    const missing = options.additionalFields.find(
      (field) =>
        field.required &&
        !(answers[String(field.fieldId)] ?? field.defaultValue).trim(),
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setBusy(true);
    setError("");
    const epoch = ++requestEpoch.current;
    const result = await proposals.createStaffCostHeader(type, id, {
      kind,
      versionId: options.versionId,
      personId: person?.personId ?? null,
      name: name.trim(),
      employeeNumber: person?.employeeNumber ?? "0",
      orgUnitId,
      projectRole,
      fundingSection: section,
      salaryModel,
      probationEndDate,
      firstIncrement,
      hrFte: hrFte === "" ? null : Number(hrFte),
      studentNumber,
      overrideInflation,
      inflationRate:
        overrideInflation && inflationRate !== ""
          ? Number(inflationRate)
          : null,
      additionalAnswers: answers,
    });
    if (epoch !== requestEpoch.current) return;
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCost(result.data);
  };
  const saveLines = async () => {
    if (!cost || busy) return;
    setBusy(true);
    setError("");
    const result = await proposals.saveStaffCostLines(type, id, {
      kind,
      versionId: options.versionId,
      costHeaderId: cost.costHeaderId,
      lines: cost.lines.map((line) => ({
        id: line.id,
        startDate: line.startDate.slice(0, 10),
        endDate: line.endDate.slice(0, 10),
        unitType: line.unitType,
        units: Number(line.units),
        baseline: baselineEdited.includes(line.id)
          ? Number(line.baseline)
          : null,
      })),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(budget);
  };
  const updateLine = () => {
    if (!cost || !editLine) return;
    const startDate = editLine.startDate.slice(0, 10);
    const endDate = editLine.endDate.slice(0, 10);
    if (
      !startDate ||
      !endDate ||
      startDate > endDate ||
      startDate < options.proposalStartDate.slice(0, 10) ||
      endDate > options.proposalEndDate.slice(0, 10)
    ) {
      setError("Cost line dates must be within the Proposal period.");
      return;
    }
    if (
      editLine.units === "" ||
      !Number.isFinite(Number(editLine.units)) ||
      Number(editLine.units) < 0 ||
      Number(editLine.units) > 1000
    ) {
      setError("Enter valid units between 0 and 1000.");
      return;
    }
    setCost({
      ...cost,
      lines: cost.lines.map((line) =>
        line.id === editLine.id ? editLine : line,
      ),
    });
    setEditLine(null);
    setError("");
  };
  const ready = kind !== "staff" || person !== null;
  return (
    <section
      id={`proposal-${id}-budget-${kind}-entry`}
      className={styles.staffEntry}
    >
      <div className={styles.staffEntryToolbar}>
        <h2>
          {names[kind]} <span title="Staff costing information">ⓘ</span>
        </h2>
        <nav aria-label="Costing types">
          <Link
            href={`${budget}/new/staff`}
            prefetch={false}
            onClick={(event) => {
              if (kind !== "staff") return;
              event.preventDefault();
              startNewCost();
            }}
          >
            Add New Staff Cost
          </Link>
          <Link
            href={`${budget}/new/student`}
            prefetch={false}
            onClick={(event) => {
              if (kind !== "student") return;
              event.preventDefault();
              startNewCost();
            }}
          >
            Add New Student Cost
          </Link>
          <Link
            href={`${budget}/new/pool-tech`}
            prefetch={false}
            onClick={(event) => {
              if (kind !== "pool-tech") return;
              event.preventDefault();
              startNewCost();
            }}
          >
            Add New Pool-Tech Cost
          </Link>
          <Link href={`${budget}/new/non-staff`} prefetch={false}>
            Add New Non-Staff Cost
          </Link>
          <Link href={budget} prefetch={false}>
            ← Back
          </Link>
        </nav>
      </div>
      <div className={styles.staffEntryBody}>
        <div className={styles.staffEntryModel}>
          <strong>Cost model</strong>
          <span>{options.costModelName}</span>
        </div>
        <h3>Personal details</h3>
        {kind === "staff" && (
          <div className={styles.staffSearch}>
            <label className="sr-only" htmlFor={`proposal-${id}-staff-search`}>
              Search
            </label>
            <input
              id={`proposal-${id}-staff-search`}
              type="search"
              placeholder="Search"
              value={search}
              onFocus={() => setShowStaffOptions(true)}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowStaffOptions(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowStaffOptions(false);
              }}
              disabled={busy}
              autoComplete="off"
            />
            <button
              className={styles.staffAvailabilityButton}
              type="button"
              aria-label="Staff Availability"
              title="Staff Availability"
              onClick={() => void openAvailability()}
              disabled={!person || availabilityBusy}
            >
              ◷
            </button>
            {showStaffOptions && (
              <ul role="listbox" aria-label="Staff search results">
                {filtered.map((item) => (
                  <li key={item.value} role="option" aria-selected="false">
                    <button
                      type="button"
                      onClick={() => void selectPerson(Number(item.value))}
                    >
                      {item.label}
                      <small>{item.orgUnitName}</small>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className={styles.staffSearchEmpty}>No staff found</li>
                )}
              </ul>
            )}
          </div>
        )}
        {ready && (
          <div className={styles.staffEntryFields}>
            <label>
              <span>
                Full Name <b aria-hidden="true">*</b>
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={
                  busy ||
                  (!!person?.employeeNumber &&
                    Number(person.employeeNumber) !== 0)
                }
              />
            </label>
            {kind === "staff" && (
              <label>
                Employee number
                <input value={person?.employeeNumber ?? ""} readOnly />
              </label>
            )}
            {kind === "student" && (
              <label>
                Student number
                <input
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                  disabled={busy}
                />
              </label>
            )}
            <div>
              <label>Org Unit</label>
              <Select
                id={`proposal-${id}-staff-org`}
                label="Org Unit"
                options={options.orgUnits}
                value={orgUnitId ? String(orgUnitId) : ""}
                onChange={(value) => setOrgUnitId(Number(value) || null)}
                disabled={busy}
              />
            </div>
            <label>
              Faculty / School
              <input
                value={
                  options.orgUnits.find(
                    (item) => item.value === String(orgUnitId),
                  )?.faculty ||
                  person?.faculty ||
                  ""
                }
                readOnly
              />
            </label>
            {kind === "staff" && (
              <>
                <label>
                  Probation end date
                  <DateInput
                    id={`proposal-${id}-staff-probation-end`}
                    label="Probation end date"
                    value={probationEndDate}
                    onChange={setProbationEndDate}
                    disabled={busy}
                  />
                </label>
                {person && Number(person.employeeNumber) === 0 ? (
                  <div>
                    <label>First Increment</label>
                    <Select
                      id={`proposal-${id}-staff-first-increment`}
                      label="First Increment"
                      options={incrementMonths}
                      value={firstIncrement}
                      onChange={setFirstIncrement}
                      disabled={busy}
                    />
                  </div>
                ) : (
                  <label>
                    First Increment
                    <input
                      value={firstIncrement}
                      onChange={(event) =>
                        setFirstIncrement(event.target.value)
                      }
                      disabled={busy}
                    />
                  </label>
                )}
              </>
            )}
            <div>
              <label>
                Project role <b aria-hidden="true">*</b>
              </label>
              <Select
                id={`proposal-${id}-staff-role`}
                label="Project role"
                options={options.roles}
                value={projectRole}
                onChange={setProjectRole}
                disabled={busy}
              />
            </div>
            <div>
              <label>
                Costing HDR section <b aria-hidden="true">*</b>
              </label>
              <Select
                id={`proposal-${id}-staff-section`}
                label="Costing HDR section"
                options={options.sections}
                value={section}
                onChange={setSection}
                disabled={busy}
              />
            </div>
            <div>
              <label>
                Salary Model <b aria-hidden="true">*</b>
              </label>
              {kind === "staff" ? (
                <Select
                  id={`proposal-${id}-staff-salary`}
                  label="Salary Model"
                  options={options.salaryModels}
                  value={salaryModel}
                  onChange={setSalaryModel}
                  disabled={busy}
                />
              ) : (
                <input
                  aria-label="Salary Model"
                  value={
                    options.salaryModels.find(
                      (item) => item.value === salaryModel,
                    )?.label ?? ""
                  }
                  readOnly
                />
              )}
            </div>
            {kind === "staff" && (
              <label>
                <span>
                  HR FTE <b aria-hidden="true">*</b>
                </span>
                <input value={hrFte} readOnly />
              </label>
            )}
            <fieldset>
              <legend>Override Inflation</legend>
              <label>
                <input
                  type="radio"
                  checked={overrideInflation}
                  onChange={() => setOverrideInflation(true)}
                />{" "}
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  checked={!overrideInflation}
                  onChange={() => setOverrideInflation(false)}
                />{" "}
                No
              </label>
            </fieldset>
            {overrideInflation && (
              <label>
                Inflation
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={inflationRate}
                  onChange={(event) => setInflationRate(event.target.value)}
                />
              </label>
            )}
          </div>
        )}
        {options.additionalFields.length > 0 && (
          <div className={styles.staffAdditional}>
            <div>Proposal Staff Cost Additional Info</div>
            {options.additionalFields.map((field) => (
              <div key={field.fieldId}>
                {field.type === "LOV" ? (
                  <Select
                    id={`proposal-${id}-staff-additional-${field.fieldId}`}
                    label={`${field.label}${field.required ? " *" : ""}`}
                    value={answers[String(field.fieldId)] ?? field.defaultValue}
                    options={field.options}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [field.fieldId]: value,
                      }))
                    }
                  />
                ) : (
                  <label
                    htmlFor={`proposal-${id}-staff-additional-${field.fieldId}`}
                  >
                    {field.label}
                    {field.required ? " *" : ""}
                    <input
                      id={`proposal-${id}-staff-additional-${field.fieldId}`}
                      value={
                        answers[String(field.fieldId)] ?? field.defaultValue
                      }
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [field.fieldId]: event.target.value,
                        }))
                      }
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
        {ready && !cost && (
          <div className={styles.staffEntryControls}>
            <button type="button" onClick={reset} disabled={busy}>
              Reset to Default
            </button>
            <button
              type="button"
              onClick={() => void getLines()}
              disabled={busy}
            >
              {busy ? "Loading…" : "Get Cost Lines"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.staffEntryError}>
            {error}
          </p>
        )}
        {cost && (
          <div className={styles.staffCostGenerated}>
            <h3>Cost Summary</h3>
            <DataTable
              id={`proposal-${id}-staff-generated-lines`}
              rowIds={`proposal-${id}-staff-generated-line`}
              rows={cost.lines}
              rowKey={(line) => String(line.id)}
              columns={[
                {
                  id: "start",
                  header: "Start date",
                  cell: (line) => line.startDate,
                },
                { id: "end", header: "End date", cell: (line) => line.endDate },
                { id: "unit", header: "Unit", cell: (line) => line.unitType },
                { id: "units", header: "Units", cell: (line) => line.units },
                {
                  id: "baseline",
                  header: "Base Cost",
                  cell: (line) => line.baseline,
                },
                {
                  id: "unindexed",
                  header: "Unindexed Cost",
                  cell: (line) => line.unindexed,
                },
                {
                  id: "total",
                  header: "Total Cost",
                  cell: (line) => line.total,
                },
                {
                  id: "edit",
                  header: "",
                  cell: (line) => (
                    <button
                      id={`proposal-${id}-staff-line-${line.id}-edit`}
                      type="button"
                      onClick={() => setEditLine(line)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                  ),
                },
              ]}
            />
            {editLine && (
              <div
                className={styles.staffEntryFields}
                id={`proposal-${id}-staff-line-editor`}
              >
                <DateInput
                  id={`proposal-${id}-staff-line-start`}
                  label="Start date"
                  value={editLine.startDate.slice(0, 10)}
                  onChange={(startDate) =>
                    setEditLine({ ...editLine, startDate })
                  }
                  disabled={busy}
                />
                <DateInput
                  id={`proposal-${id}-staff-line-end`}
                  label="End date"
                  value={editLine.endDate.slice(0, 10)}
                  onChange={(endDate) => setEditLine({ ...editLine, endDate })}
                  disabled={busy}
                />
                <Select
                  id={`proposal-${id}-staff-line-unit`}
                  label="Unit"
                  value={editLine.unitType}
                  options={options.unitTypes}
                  onChange={(unitType) =>
                    setEditLine({ ...editLine, unitType })
                  }
                  disabled={busy}
                />
                <label htmlFor={`proposal-${id}-staff-line-units`}>Units</label>
                <input
                  id={`proposal-${id}-staff-line-units`}
                  type="number"
                  min="0"
                  max="1000"
                  step="any"
                  value={editLine.units}
                  onChange={(event) =>
                    setEditLine({ ...editLine, units: event.target.value })
                  }
                  disabled={busy}
                />
                {options.canEditBaseline && salaryModel === "F" && (
                  <>
                    <label htmlFor={`proposal-${id}-staff-line-baseline`}>
                      Base Cost
                    </label>
                    <input
                      id={`proposal-${id}-staff-line-baseline`}
                      type="number"
                      min="0"
                      step="any"
                      value={editLine.baseline}
                      onChange={(event) => {
                        setEditLine({
                          ...editLine,
                          baseline: event.target.value,
                        });
                        setBaselineEdited((ids) =>
                          ids.includes(editLine.id)
                            ? ids
                            : [...ids, editLine.id],
                        );
                      }}
                      disabled={busy}
                    />
                  </>
                )}
                <button
                  id={`proposal-${id}-staff-line-apply`}
                  type="button"
                  onClick={updateLine}
                  disabled={busy}
                >
                  Apply
                </button>
                <button
                  id={`proposal-${id}-staff-line-cancel`}
                  type="button"
                  onClick={() => setEditLine(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              id={`proposal-${id}-staff-lines-save`}
              type="button"
              onClick={() => void saveLines()}
              disabled={busy || !!editLine}
            >
              <Icon name="save" /> {busy ? "Saving…" : "Save Cost Lines"}
            </button>
          </div>
        )}
      </div>
      {availability && (
        <ActionDialog
          id={`proposal-${id}-staff-availability`}
          title="Staff Availability"
          closeLabel="Close Staff Availability"
          onClose={() => setAvailability(null)}
          width="50vw"
          className={styles.staffAvailabilityDialog}
        >
          <StaffAvailabilityTimeline data={availability} />
        </ActionDialog>
      )}
    </section>
  );
}

function StaffAvailabilityTimeline({ data }: { data: Availability }) {
  const starts = data.items.map((item) => Date.parse(item.startDate));
  const ends = data.items.map((item) => Date.parse(item.endDate));
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const span = Math.max(1, max - min);
  const position = (date: string) =>
    Math.max(0, Math.min(100, ((Date.parse(date) - min) / span) * 100));
  const years = Array.from(
    {
      length:
        new Date(max).getUTCFullYear() - new Date(min).getUTCFullYear() + 1,
    },
    (_, index) => new Date(min).getUTCFullYear() + index,
  );
  return (
    <>
      <div className={styles.staffAvailabilityDates}>
        <label>
          Start Date
          <input value={`${data.startDate}T00:00:00`} readOnly />
        </label>
        <label>
          End Date
          <input value={`${data.endDate}T00:00:00`} readOnly />
        </label>
      </div>
      <div className={styles.staffAvailabilityScroll}>
        <div
          className={styles.staffAvailabilityTimeline}
          aria-label="Overview of Staff Availability"
        >
          {data.items.map((item, index) => {
            const left = position(item.startDate);
            const width = Math.max(1, position(item.endDate) - left);
            return (
              <div
                className={styles.staffAvailabilityRow}
                key={`${item.proposalNumber}-${index}`}
              >
                <div
                  className={styles.staffAvailabilityBar}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${item.proposalNumber} • FTE: ${item.fte} • ${item.startDate} to ${item.endDate}`}
                >
                  <strong>{item.proposalNumber}</strong>
                  <span>FTE: {item.fte}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.staffAvailabilityOverview}>
        <div className={styles.staffAvailabilityYears}>
          {years.map((year) => (
            <span
              key={year}
              style={{
                left: `${Math.min(94, ((Date.UTC(year, 0, 1) - min) / span) * 100)}%`,
              }}
            >
              {year}
            </span>
          ))}
        </div>
        <div className={styles.staffAvailabilityOverviewBars}>
          {data.items.map((item, index) => (
            <div
              key={`${item.proposalNumber}-${index}`}
              style={{
                left: `${position(item.startDate)}%`,
                width: `${Math.max(1, position(item.endDate) - position(item.startDate))}%`,
                top: `${index * 4}px`,
              }}
              title={`${item.proposalNumber} • FTE: ${item.fte}`}
            />
          ))}
        </div>
        <div className={styles.staffAvailabilityYears}>
          {years.map((year) => (
            <span
              key={year}
              style={{
                left: `${Math.min(94, ((Date.UTC(year, 0, 1) - min) / span) * 100)}%`,
              }}
            >
              {year}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
