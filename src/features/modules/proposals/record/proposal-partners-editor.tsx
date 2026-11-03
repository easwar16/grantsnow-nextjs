"use client";
import { useState } from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import { DataTable, type TableAction } from "@/components/ui/data-table";
import styles from "./proposal-record.module.css";

type Collaborator = {
  relationId: number | null;
  collaboratorId: number;
  name: string;
  roleCode: string;
  description: string;
  countryCode: string;
  vatCode: string;
  costingEnabled: boolean;
};
type Subproject = {
  relationId: number | null;
  personId: number;
  employeeNumber: string;
  orgUnitId: number;
  name: string;
  orgUnitName: string;
  typeCode: string;
  excludePricing: boolean;
};

function YesNo({
  id,
  value,
  onChange,
  question,
  allowNo = true,
}: {
  id: string;
  value: boolean;
  onChange: (value: boolean) => void;
  question: string;
  allowNo?: boolean;
}) {
  return (
    <fieldset id={id} className={styles.partnerRadio}>
      <legend>{question}</legend>
      <label>
        <input
          id={`${id}-yes`}
          type="radio"
          name={`${id}-answer`}
          checked={value}
          onChange={() => onChange(true)}
        />{" "}
        Yes
      </label>
      <label>
        <input
          id={`${id}-no`}
          type="radio"
          name={`${id}-answer`}
          checked={!value}
          disabled={!allowNo}
          onChange={() => onChange(false)}
        />{" "}
        No
      </label>
    </fieldset>
  );
}

/** Edit or done, then delete when allowed: the partner tables' row actions (by row position, as the editors track). */
function rowActions<Row extends { name: string }>(
  editing: number | null,
  setEditing: (index: number | null) => void,
  rows: Row[],
  setRows: (update: (current: Row[]) => Row[]) => void,
  canDelete: boolean,
): TableAction<Row>[] {
  return [
    {
      id: "done",
      icon: "check",
      label: (row) => `Done editing ${row.name}`,
      hidden: (row) => editing !== rows.indexOf(row),
      onClick: () => setEditing(null),
    },
    {
      id: "edit",
      icon: "edit",
      label: (row) => `Edit ${row.name}`,
      hidden: (row) => editing === rows.indexOf(row),
      onClick: (row) => setEditing(rows.indexOf(row)),
    },
    {
      id: "delete",
      icon: "trash",
      label: (row) => `Delete ${row.name}`,
      hidden: () => !canDelete,
      onClick: (row) => {
        const index = rows.indexOf(row);
        setRows((current) => current.filter((_, at) => at !== index));
      },
    },
  ];
}

export function ProposalCollaboratorsEditor({
  id,
  question,
  initial,
  candidates,
  roles,
  canDelete,
}: {
  id: string;
  question: string;
  initial: Collaborator[];
  candidates: {
    id: number;
    name: string;
    countryCode: string;
    vatCode: string;
  }[];
  roles: SelectOption[];
  canDelete: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [yes, setYes] = useState(initial.length > 0);
  const [editing, setEditing] = useState<number | null>(null);
  const form = `proposal-${id}-edit-form`;
  const update = (index: number, next: Collaborator) =>
    setRows((current) => current.map((row, at) => (at === index ? next : row)));
  const add = (value: string) => {
    const candidate = candidates.find((item) => String(item.id) === value);
    if (!candidate || rows.some((row) => row.collaboratorId === candidate.id))
      return;
    setRows((current) => [
      ...current,
      {
        relationId: null,
        collaboratorId: candidate.id,
        name: candidate.name,
        roleCode: roles[0]?.value ?? "",
        description: "",
        countryCode: candidate.countryCode,
        vatCode: candidate.vatCode,
        costingEnabled: false,
      },
    ]);
  };
  return (
    <div id={`proposal-${id}-collaborator-editor`}>
      <YesNo
        id={`proposal-${id}-collaborator-answer`}
        question={question}
        value={yes}
        onChange={setYes}
        allowNo={canDelete || initial.length === 0}
      />
      {yes && (
        <>
          <div className={styles.partnerAdd}>
            <Select
              id={`proposal-${id}-add-collaborator`}
              label="Add Research partners"
              value=""
              onChange={add}
              options={candidates
                .filter(
                  (item) => !rows.some((row) => row.collaboratorId === item.id),
                )
                .map((item) => ({ value: String(item.id), label: item.name }))}
            />
          </div>
          <DataTable
            id={`proposal-${id}-collaborators-table`}
            rowIds={`proposal-${id}-collaborator`}
            columns={[
              {
                id: "name",
                header: "Research Partner",
                cell: (row) => row.name,
              },
              {
                id: "role",
                header: "Role",
                cell: (row) => {
                  const index = rows.indexOf(row);
                  return editing === index ? (
                    <Select
                      id={`proposal-${id}-collaborator-role-${index}`}
                      label={`${row.name} role`}
                      options={roles}
                      value={row.roleCode}
                      onChange={(roleCode) =>
                        update(index, { ...row, roleCode })
                      }
                    />
                  ) : (
                    (roles.find((item) => item.value === row.roleCode)?.label ??
                      row.roleCode)
                  );
                },
              },
              {
                id: "description",
                header: "Description",
                cell: (row) => {
                  const index = rows.indexOf(row);
                  return editing === index ? (
                    <input
                      id={`proposal-${id}-collaborator-description-${index}`}
                      aria-label={`${row.name} description`}
                      value={row.description}
                      maxLength={1000}
                      onChange={(event) =>
                        update(index, {
                          ...row,
                          description: event.target.value,
                        })
                      }
                    />
                  ) : (
                    row.description
                  );
                },
              },
              {
                id: "country",
                header: "Country Code",
                cell: (row) => row.countryCode,
              },
              { id: "vat", header: "Vat Code", cell: (row) => row.vatCode },
              {
                id: "cost-enabled",
                header: "Cost Enabled",
                cell: (row) => {
                  const index = rows.indexOf(row);
                  return (
                    <input
                      id={`proposal-${id}-collaborator-cost-enabled-${index}`}
                      aria-label={`${row.name} cost enabled`}
                      type="checkbox"
                      checked={row.costingEnabled}
                      disabled={editing !== index}
                      onChange={(event) =>
                        update(index, {
                          ...row,
                          costingEnabled: event.target.checked,
                        })
                      }
                    />
                  );
                },
              },
            ]}
            rows={rows}
            rowKey={(row) => String(row.relationId ?? row.collaboratorId)}
            actionsLabel="Actions"
            actionsClassName={styles.summaryRowActions}
            actions={rowActions(editing, setEditing, rows, setRows, canDelete)}
            empty={
              <span className={styles.summaryEmpty}>No data to display.</span>
            }
          />
        </>
      )}
      <input
        type="hidden"
        name="collaborators"
        form={form}
        value={JSON.stringify(
          yes
            ? rows.map(
                ({
                  relationId,
                  collaboratorId,
                  roleCode,
                  description,
                  costingEnabled,
                }) => ({
                  relationId,
                  collaboratorId,
                  roleCode,
                  description,
                  costingEnabled,
                }),
              )
            : [],
        )}
        readOnly
      />
      <input
        type="hidden"
        name="collaboratorFlag"
        form={form}
        value={yes ? "Y" : "N"}
        readOnly
      />
    </div>
  );
}

export function ProposalSubprojectsEditor({
  id,
  question,
  initial,
  candidates,
  types,
  canDelete,
  piPersonId,
}: {
  id: string;
  question: string;
  initial: Subproject[];
  candidates: {
    personId: number;
    employeeNumber: string;
    name: string;
    orgUnitId: number;
    orgUnitName: string;
  }[];
  types: SelectOption[];
  canDelete: boolean;
  piPersonId: number | null;
}) {
  const [rows, setRows] = useState(initial);
  const [yes, setYes] = useState(initial.length > 0);
  const [typeCode, setTypeCode] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const form = `proposal-${id}-edit-form`;
  const update = (index: number, next: Subproject) =>
    setRows((current) => current.map((row, at) => (at === index ? next : row)));
  const add = (value: string) => {
    const person = candidates.find(
      (item) => `${item.personId}:${item.orgUnitId}` === value,
    );
    if (
      !person ||
      !typeCode ||
      person.personId === piPersonId ||
      rows.some(
        (row) =>
          row.employeeNumber === person.employeeNumber &&
          row.orgUnitId === person.orgUnitId,
      )
    )
      return;
    setRows((current) => [
      ...current,
      {
        ...person,
        relationId: null,
        typeCode,
        excludePricing: typeCode !== "INTERNAL_DEPT",
      },
    ]);
  };
  return (
    <div id={`proposal-${id}-subproject-editor`}>
      <div className={styles.partnerTop}>
        <YesNo
          id={`proposal-${id}-subproject-answer`}
          question={question}
          value={yes}
          onChange={setYes}
          allowNo={canDelete || initial.length === 0}
        />
        {yes && (
          <div className={styles.partnerAdd}>
            <Select
              id={`proposal-${id}-subproject-type`}
              label="Sub-proposal type"
              value={typeCode}
              onChange={setTypeCode}
              options={types}
            />
            <Select
              id={`proposal-${id}-add-subproject`}
              label="Add Subproject"
              value=""
              onChange={add}
              disabled={!typeCode}
              options={candidates
                .filter(
                  (item) =>
                    item.personId !== piPersonId &&
                    !rows.some(
                      (row) =>
                        row.employeeNumber === item.employeeNumber &&
                        row.orgUnitId === item.orgUnitId,
                    ),
                )
                .map((item) => ({
                  value: `${item.personId}:${item.orgUnitId}`,
                  label: `${item.name} — ${item.orgUnitName}`,
                }))}
            />
          </div>
        )}
      </div>
      {yes && (
        <>
          <DataTable
            id={`proposal-${id}-subprojects-table`}
            rowIds={`proposal-${id}-subproject`}
            className={styles.partnerTable}
            columns={[
              {
                id: "type",
                header: "Type",
                cell: (row) =>
                  types.find((item) => item.value === row.typeCode)?.label ??
                  row.typeCode,
              },
              { id: "name", header: "Name", cell: (row) => row.name },
              {
                id: "org-unit",
                header: "Org Unit",
                cell: (row) => row.orgUnitName,
              },
              { id: "role", header: "Role", cell: () => "SCO-I" },
              {
                id: "exclude-pricing",
                header: "Exclude Pricing",
                cell: (row) => {
                  const index = rows.indexOf(row);
                  return (
                    <input
                      id={`proposal-${id}-subproject-exclude-pricing-${index}`}
                      aria-label={`${row.name} exclude pricing`}
                      type="checkbox"
                      checked={row.excludePricing}
                      disabled={editing !== index}
                      onChange={(event) =>
                        update(index, {
                          ...row,
                          excludePricing: event.target.checked,
                        })
                      }
                    />
                  );
                },
              },
              {
                id: "proposal-number",
                header: "Proposal Number",
                cell: () => " ",
              },
            ]}
            rows={rows}
            // Unsaved rows add the org unit: one person may be added under two.
            rowKey={(row) =>
              String(row.relationId ?? `${row.personId}-${row.orgUnitId}`)
            }
            actionsLabel="Actions"
            actionsClassName={styles.summaryRowActions}
            actions={rowActions(editing, setEditing, rows, setRows, canDelete)}
            empty={
              <span className={styles.summaryEmpty}>No data to display.</span>
            }
          />
        </>
      )}
      <input
        type="hidden"
        name="subprojects"
        form={form}
        value={JSON.stringify(
          yes
            ? rows.map(
                ({
                  relationId,
                  personId,
                  orgUnitId,
                  employeeNumber,
                  typeCode,
                  excludePricing,
                }) => ({
                  relationId,
                  personId,
                  orgUnitId,
                  employeeNumber,
                  typeCode,
                  excludePricing,
                }),
              )
            : [],
        )}
        readOnly
      />
      <input
        type="hidden"
        name="subprojectFlag"
        form={form}
        value={yes ? "Y" : "N"}
        readOnly
      />
    </div>
  );
}
