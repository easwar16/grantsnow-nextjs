"use client";
import { useState } from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
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
          type="radio"
          name={`${id}-answer`}
          checked={value}
          onChange={() => onChange(true)}
        />{" "}
        Yes
      </label>
      <label>
        <input
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
          <table>
            <thead>
              <tr>
                <th scope="col">Research Partner</th>
                <th scope="col">Role</th>
                <th scope="col">Description</th>
                <th scope="col">Country Code</th>
                <th scope="col">Vat Code</th>
                <th scope="col">Cost Enabled</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.summaryEmpty}>
                    No data to display.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    id={`proposal-${id}-collaborator-${row.relationId ?? row.collaboratorId}`}
                    key={row.relationId ?? `new-${row.collaboratorId}`}
                  >
                    <td>{row.name}</td>
                    <td>
                      {editing === index ? (
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
                        (roles.find((item) => item.value === row.roleCode)
                          ?.label ?? row.roleCode)
                      )}
                    </td>
                    <td>
                      {editing === index ? (
                        <input
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
                      )}
                    </td>
                    <td>{row.countryCode}</td>
                    <td>{row.vatCode}</td>
                    <td>
                      <input
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
                    </td>
                    <td className={styles.summaryRowActions}>
                      {editing === index ? (
                        <button
                          type="button"
                          aria-label={`Done editing ${row.name}`}
                          onClick={() => setEditing(null)}
                        >
                          <Icon name="check" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => setEditing(index)}
                        >
                          <Icon name="edit" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete ${row.name}`}
                          onClick={() =>
                            setRows((current) =>
                              current.filter((_, at) => at !== index),
                            )
                          }
                        >
                          <Icon name="trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
          <table className={styles.partnerTable}>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Name</th>
                <th scope="col">Org Unit</th>
                <th scope="col">Role</th>
                <th scope="col">Exclude Pricing</th>
                <th scope="col">Proposal Number</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.summaryEmpty}>
                    No data to display.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    id={`proposal-${id}-subproject-${row.relationId ?? row.personId}`}
                    key={
                      row.relationId ?? `new-${row.personId}-${row.orgUnitId}`
                    }
                  >
                    <td>
                      {types.find((item) => item.value === row.typeCode)
                        ?.label ?? row.typeCode}
                    </td>
                    <td>{row.name}</td>
                    <td>{row.orgUnitName}</td>
                    <td>SCO-I</td>
                    <td>
                      <input
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
                    </td>
                    <td> </td>
                    <td className={styles.summaryRowActions}>
                      {editing === index ? (
                        <button
                          type="button"
                          aria-label={`Done editing ${row.name}`}
                          onClick={() => setEditing(null)}
                        >
                          <Icon name="check" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => setEditing(index)}
                        >
                          <Icon name="edit" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete ${row.name}`}
                          onClick={() =>
                            setRows((current) =>
                              current.filter((_, at) => at !== index),
                            )
                          }
                        >
                          <Icon name="trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
