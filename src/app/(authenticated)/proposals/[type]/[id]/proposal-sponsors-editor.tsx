"use client";
import { useState } from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { useConfirm } from "@/components/dialog/action-dialog";
import styles from "./proposal-record.module.css";

type Sponsor = {
  relationId: number | null;
  partyId: number;
  name: string;
  funderType: string;
  roleCode: string;
  priority: number;
};

export function ProposalSponsorsEditor({
  id,
  initial,
  sponsors,
  types,
  roles,
  labels,
  canDelete,
}: {
  id: string;
  initial: Sponsor[];
  sponsors: (SelectOption & { type: string })[];
  types: SelectOption[];
  roles: SelectOption[];
  canDelete: boolean;
  labels: {
    funder: string;
    funderType: string;
    funderRole: string;
    priority: string;
    noData: string;
    funderTypeVisible: boolean;
  };
}) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [funderType, setFunderType] = useState("");
  const [draft, setDraft] = useState<Sponsor | null>(null);
  const confirmDelete = useConfirm(`proposal-${id}-delete-sponsor-dialog`);
  const update = (index: number, next: Sponsor) =>
    setRows((current) => current.map((row, at) => (at === index ? next : row)));
  const add = (selected: string) => {
    const option = sponsors.find((item) => item.value === selected);
    if (
      !option ||
      rows.length >= 5 ||
      rows.some((row) => row.partyId === Number(option.value))
    )
      return;
    const roleCode = rows.length
      ? (roles.find((item) => item.value === "SEC")?.value ??
        roles.find((item) => item.value !== "PRM")?.value)
      : "PRM";
    if (!roleCode) return;
    setRows((current) => [
      ...current,
      {
        relationId: null,
        partyId: Number(option.value),
        name: option.label,
        funderType:
          types.find((item) => item.value === option.type)?.label ?? "",
        roleCode,
        priority: current.length + 1,
      },
    ]);
  };
  const formId = `proposal-${id}-edit-form`;
  return (
    <div id={`proposal-${id}-sponsor-editor`}>
      <div className={styles.sponsorAdd}>
        <Select
          id={`proposal-${id}-sponsor-type`}
          label="Funder Type"
          options={types}
          value={funderType}
          onChange={setFunderType}
        />
        <Select
          id={`proposal-${id}-add-sponsor`}
          label="Add Funder"
          options={sponsors.filter(
            (item) =>
              rows.length < 5 &&
              (!funderType || item.type === funderType) &&
              !rows.some((row) => String(row.partyId) === item.value),
          )}
          value=""
          onChange={add}
        />
      </div>
      <input
        type="hidden"
        name="sponsors"
        form={formId}
        value={JSON.stringify(
          rows.map(({ relationId, partyId, roleCode, priority }) => ({
            relationId,
            partyId,
            roleCode,
            priority,
          })),
        )}
        readOnly
      />
      <table>
        <thead>
          <tr>
            <th scope="col">{labels.funder}</th>
            {labels.funderTypeVisible && (
              <th scope="col">{labels.funderType}</th>
            )}
            <th scope="col">{labels.funderRole}</th>
            <th scope="col">{labels.priority}</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={labels.funderTypeVisible ? 5 : 4}
                className={styles.summaryEmpty}
              >
                {labels.noData}
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr
              id={`proposal-${id}-sponsor-${row.relationId ?? `new-${row.partyId}`}`}
              key={row.relationId ?? `new-${row.partyId}`}
            >
              <td>{row.name}</td>
              {labels.funderTypeVisible && <td>{row.funderType}</td>}
              <td>
                {editing === index ? (
                  <Select
                    id={`proposal-${id}-sponsor-role-${index}`}
                    label={`${row.name} role`}
                    options={roles}
                    value={row.roleCode}
                    onChange={(roleCode) => update(index, { ...row, roleCode })}
                  />
                ) : (
                  (roles.find((item) => item.value === row.roleCode)?.label ??
                  row.roleCode)
                )}
              </td>
              <td>
                {editing === index ? (
                  <input
                    id={`proposal-${id}-sponsor-priority-${index}`}
                    aria-label={`${row.name} priority`}
                    type="number"
                    min={1}
                    max={999}
                    value={row.priority}
                    disabled={row.roleCode === "PRM"}
                    onChange={(event) =>
                      update(index, {
                        ...row,
                        priority: Number(event.target.value),
                      })
                    }
                  />
                ) : (
                  row.priority
                )}
              </td>
              <td className={styles.summaryRowActions}>
                {editing === index ? (
                  <>
                    <button
                      type="button"
                      aria-label={`Done editing ${row.name}`}
                      onClick={() => {
                        setEditing(null);
                        setDraft(null);
                      }}
                    >
                      <Icon name="check" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Cancel editing ${row.name}`}
                      onClick={() => {
                        if (draft) update(index, draft);
                        setEditing(null);
                        setDraft(null);
                      }}
                    >
                      <Icon name="multiply" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${row.name}`}
                      onClick={() => {
                        setDraft(row);
                        setEditing(index);
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${row.name}`}
                      disabled={!canDelete}
                      onClick={async () => {
                        const accepted = await confirmDelete.ask({
                          title: "Warning",
                          message:
                            "This operation will remove this record permanently. Do you want to proceed?",
                          confirm: "Yes",
                          cancel: "Cancel",
                          danger: true,
                        });
                        if (accepted)
                          setRows((current) =>
                            current
                              .filter(
                                (sponsor) => sponsor.partyId !== row.partyId,
                              )
                              .map((sponsor, at) => ({
                                ...sponsor,
                                priority: at + 1,
                              })),
                          );
                      }}
                    >
                      <Icon name="trash" />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirmDelete.element}
    </div>
  );
}
