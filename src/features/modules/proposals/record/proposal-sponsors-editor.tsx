"use client";
import { useState } from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { useConfirm } from "@/components/dialog/action-dialog";
import styles from "./proposal-record.module.css";
import { ProposalFieldValidation } from "./proposal-edit-form";

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
  formId: givenFormId,
}: {
  id: string;
  initial: Sponsor[];
  sponsors: (SelectOption & { type: string })[];
  types: SelectOption[];
  roles: SelectOption[];
  canDelete: boolean;
  formId?: string;
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
  const remove = async (row: Sponsor) => {
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
          .filter((sponsor) => sponsor.partyId !== row.partyId)
          .map((sponsor, at) => ({
            ...sponsor,
            priority: at + 1,
          })),
      );
  };
  const formId = givenFormId ?? `proposal-${id}-edit-form`;
  return (
    <div id={`proposal-${id}-sponsor-editor`}>
      <div className={styles.sponsorAdd}>
        <label htmlFor={`proposal-${id}-sponsor-type-trigger`}>
          FunderType
        </label>
        <Select
          id={`proposal-${id}-sponsor-type`}
          label="Funder Type"
          options={types}
          value={funderType}
          onChange={setFunderType}
        />
        <label htmlFor={`proposal-${id}-add-sponsor-trigger`}>Add Funder</label>
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
        {id === "new" && (
          <ProposalFieldValidation id="proposal-new-add-sponsor-trigger" />
        )}
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
      <DataTable
        id={`proposal-${id}-sponsors-table`}
        rowIds={`proposal-${id}-sponsor`}
        columns={[
          { id: "funder", header: labels.funder, cell: (row) => row.name },
          ...(labels.funderTypeVisible
            ? [
                {
                  id: "funder-type",
                  header: labels.funderType,
                  cell: (row: Sponsor) => row.funderType,
                },
              ]
            : []),
          {
            id: "role",
            header: labels.funderRole,
            cell: (row) => {
              const index = rows.indexOf(row);
              return editing === index ? (
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
              );
            },
          },
          {
            id: "priority",
            header: labels.priority,
            cell: (row) => {
              const index = rows.indexOf(row);
              return editing === index ? (
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
              );
            },
          },
        ]}
        rows={rows}
        rowKey={(row) => String(row.relationId ?? `new-${row.partyId}`)}
        actionsLabel="Actions"
        actionsClassName={styles.summaryRowActions}
        actions={[
          {
            id: "done",
            icon: "check",
            label: (row) => `Done editing ${row.name}`,
            hidden: (row) => editing !== rows.indexOf(row),
            onClick: () => {
              setEditing(null);
              setDraft(null);
            },
          },
          {
            id: "cancel",
            icon: "multiply",
            label: (row) => `Cancel editing ${row.name}`,
            hidden: (row) => editing !== rows.indexOf(row),
            onClick: (row) => {
              if (draft) update(rows.indexOf(row), draft);
              setEditing(null);
              setDraft(null);
            },
          },
          {
            id: "edit",
            icon: "edit",
            label: (row) => `Edit ${row.name}`,
            hidden: (row) => editing === rows.indexOf(row),
            onClick: (row) => {
              setDraft(row);
              setEditing(rows.indexOf(row));
            },
          },
          {
            id: "delete",
            icon: "trash",
            label: (row) => `Delete ${row.name}`,
            hidden: (row) => editing === rows.indexOf(row),
            disabled: () => !canDelete,
            onClick: (row) => void remove(row),
          },
        ]}
        empty={<span className={styles.summaryEmpty}>{labels.noData}</span>}
      />
      {confirmDelete.element}
    </div>
  );
}
