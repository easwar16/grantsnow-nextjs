"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@/components/ui/collapsible";
import { DataTable } from "@/components/ui/data-table";
import { useConfirm } from "@/components/dialog/action-dialog";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Select } from "@/components/ui/select";
import { proposals } from "@/lib/api";
import { functions } from "@/lib/functions";
import type { FormattingConfiguration } from "@/server/platform/configuration/formatting";
import type { proposalInKind } from "@/server/modules/proposals/record/in-kind";
import styles from "./proposal-record.module.css";

type Data = Awaited<ReturnType<typeof proposalInKind>>;
type Line = Data["lines"][number];
type Labels = {
  save: string;
  cancel: string;
  edit: string;
  add: string;
  amount: string;
  item: string;
  type: string;
  description: string;
};

export function InKindContribution({
  type,
  id,
  sponsors,
  lines,
  costItems,
  types,
  canEdit,
  canDelete,
  labels,
  visible,
  format,
}: {
  type: string;
  id: string;
  sponsors: Data["sponsors"];
  lines: Line[];
  costItems: Data["costItems"];
  types: Data["types"];
  canEdit: boolean;
  canDelete: boolean;
  labels: Labels;
  visible: { item: boolean; type: boolean; description: boolean };
  format?: FormattingConfiguration;
}) {
  const router = useRouter();
  const confirm = useConfirm(`proposal-${id}-in-kind-delete-dialog`);
  const [total, setTotal] = useState<{ id: number; value: string } | null>(
    null,
  );
  const [line, setLine] = useState<{
    id: number;
    amount: string;
  } | null>(null);
  const [adding, setAdding] = useState<{
    sponsorId: number;
    costItemCode: string;
    type: string;
    description: string;
    amount: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const money = (value: number) =>
    functions.format.moneyDisplay(String(value), format?.currency, format);
  const saveTotal = async () => {
    if (!total || busy) return;
    const amount = Number(total.value);
    if (total.value.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid contribution total.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await proposals.saveInKindTotals(
      type,
      id,
      sponsors.map((sponsor) => ({
        id: sponsor.id,
        amount: sponsor.id === total.id ? amount : sponsor.amount,
      })),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setTotal(null);
    router.refresh();
  };
  const saveLine = async () => {
    if (!line || busy) return;
    const amount = Number(line.amount);
    if (line.amount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid In-kind amount.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await proposals.saveInKindLine(type, id, {
      id: line.id,
      amount,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setLine(null);
    router.refresh();
  };
  const remove = async (item: Line) => {
    if (
      busy ||
      !(await confirm.ask({
        title: "Delete In-kind Contribution",
        message: `Delete ${item.item || labels.item}?`,
        confirm: "Delete",
        cancel: labels.cancel,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    const result = await proposals.removeInKindLine(type, id, item.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };
  const addLine = async () => {
    if (!adding || busy) return;
    const amount = Number(adding.amount);
    if (adding.amount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid In-kind amount.");
      return;
    }
    if (!adding.costItemCode && !adding.type) {
      setError("Select a cost item or In-kind type.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await proposals.addInKindLine(type, id, {
      ...adding,
      amount,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setAdding(null);
    router.refresh();
  };
  return (
    <section
      id={`proposal-${id}-in-kind-contribution`}
      className={styles.creditAllocation}
    >
      {sponsors.length === 0 && (
        <p id={`proposal-${id}-in-kind-empty`}>No data to display.</p>
      )}
      {error && (
        <p id={`proposal-${id}-in-kind-error`} role="alert">
          {error}
        </p>
      )}
      {sponsors.map((sponsor) => {
        const sponsorLines = lines.filter(
          (item) => item.sponsorId === sponsor.id,
        );
        return (
          <Collapsible
            key={sponsor.id}
            id={`proposal-${id}-in-kind-sponsor-${sponsor.id}`}
            heading={`${sponsor.name} — ${money(sponsor.amount)}`}
            defaultOpen
          >
            {canEdit && (
              <button
                id={`proposal-${id}-in-kind-total-edit-${sponsor.id}`}
                type="button"
                onClick={() => {
                  setTotal({ id: sponsor.id, value: String(sponsor.amount) });
                  setLine(null);
                  setError("");
                }}
                disabled={busy}
              >
                {labels.edit} total
              </button>
            )}
            {canEdit && (visible.item || visible.type) && (
              <button
                id={`proposal-${id}-in-kind-add-${sponsor.id}`}
                type="button"
                onClick={() => {
                  setAdding({
                    sponsorId: sponsor.id,
                    costItemCode: "",
                    type: "",
                    description: "",
                    amount: "0",
                  });
                  setError("");
                }}
                disabled={busy}
              >
                {labels.add}
              </button>
            )}
            {total?.id === sponsor.id && (
              <div
                id={`proposal-${id}-in-kind-total-editor-${sponsor.id}`}
                className={styles.staffEntryFields}
              >
                <label htmlFor={`proposal-${id}-in-kind-total-${sponsor.id}`}>
                  {labels.amount}
                </label>
                <input
                  id={`proposal-${id}-in-kind-total-${sponsor.id}`}
                  type="number"
                  min="0"
                  step="any"
                  value={total.value}
                  onChange={(event) =>
                    setTotal({ ...total, value: event.target.value })
                  }
                  disabled={busy}
                />
                <button
                  id={`proposal-${id}-in-kind-total-save-${sponsor.id}`}
                  type="button"
                  onClick={() => void saveTotal()}
                  disabled={busy}
                >
                  {labels.save}
                </button>
                <button
                  id={`proposal-${id}-in-kind-total-cancel-${sponsor.id}`}
                  type="button"
                  onClick={() => setTotal(null)}
                  disabled={busy}
                >
                  {labels.cancel}
                </button>
              </div>
            )}
            <DataTable
              id={`proposal-${id}-in-kind-lines-${sponsor.id}`}
              rowIds={`proposal-${id}-in-kind-line`}
              rows={sponsorLines}
              rowKey={(item) => String(item.id)}
              columns={[
                ...(visible.item
                  ? [
                      {
                        id: "item",
                        header: labels.item,
                        cell: (item: Line) => item.item,
                      },
                    ]
                  : []),
                {
                  id: "amount",
                  header: labels.amount,
                  cell: (item: Line) => money(item.amount),
                },
                ...(visible.type
                  ? [
                      {
                        id: "type",
                        header: labels.type,
                        cell: (item: Line) => item.type,
                      },
                    ]
                  : []),
                ...(visible.description
                  ? [
                      {
                        id: "description",
                        header: labels.description,
                        cell: (item: Line) => item.description,
                      },
                    ]
                  : []),
              ]}
              actions={
                canEdit || canDelete
                  ? [
                      ...(canEdit
                        ? [
                            {
                              id: "edit",
                              icon: "edit" as const,
                              label: (item: Line) =>
                                `${labels.edit} ${item.item}`,
                              onClick: (item: Line) => {
                                setLine({
                                  id: item.id,
                                  amount: String(item.amount),
                                });
                                setTotal(null);
                                setError("");
                              },
                              disabled: () => busy,
                            },
                          ]
                        : []),
                      ...(canDelete
                        ? [
                            {
                              id: "delete",
                              icon: "trash" as const,
                              label: (item: Line) => `Delete ${item.item}`,
                              onClick: (item: Line) => void remove(item),
                              disabled: () => busy,
                            },
                          ]
                        : []),
                    ]
                  : undefined
              }
              empty="No data to display."
            />
            {line && sponsorLines.some((item) => item.id === line.id) && (
              <div
                id={`proposal-${id}-in-kind-line-editor-${line.id}`}
                className={styles.staffEntryFields}
              >
                <label
                  htmlFor={`proposal-${id}-in-kind-line-amount-${line.id}`}
                >
                  {labels.amount}
                </label>
                <input
                  id={`proposal-${id}-in-kind-line-amount-${line.id}`}
                  type="number"
                  min="0"
                  step="any"
                  value={line.amount}
                  onChange={(event) =>
                    setLine({ ...line, amount: event.target.value })
                  }
                  disabled={busy}
                />
                <button
                  id={`proposal-${id}-in-kind-line-save-${line.id}`}
                  type="button"
                  onClick={() => void saveLine()}
                  disabled={busy}
                >
                  {labels.save}
                </button>
                <button
                  id={`proposal-${id}-in-kind-line-cancel-${line.id}`}
                  type="button"
                  onClick={() => setLine(null)}
                  disabled={busy}
                >
                  {labels.cancel}
                </button>
              </div>
            )}
          </Collapsible>
        );
      })}
      {adding && (
        <ActionDialog
          id={`proposal-${id}-in-kind-add-dialog`}
          title={labels.add}
          onClose={() => setAdding(null)}
        >
          <div className={styles.staffEntryFields}>
            {visible.item && (
              <Select
                id={`proposal-${id}-in-kind-cost-item`}
                label={labels.item}
                options={costItems.map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
                value={adding.costItemCode}
                onChange={(costItemCode) =>
                  setAdding({ ...adding, costItemCode })
                }
                disabled={busy}
              />
            )}
            {visible.type && (
              <Select
                id={`proposal-${id}-in-kind-type`}
                label={labels.type}
                options={types}
                value={adding.type}
                onChange={(type) => setAdding({ ...adding, type })}
                disabled={busy}
              />
            )}
            <label htmlFor={`proposal-${id}-in-kind-new-amount`}>
              {labels.amount}
            </label>
            <input
              id={`proposal-${id}-in-kind-new-amount`}
              type="number"
              min="0"
              step="any"
              value={adding.amount}
              onChange={(event) =>
                setAdding({ ...adding, amount: event.target.value })
              }
              disabled={busy}
            />
            {visible.description && (
              <>
                <label htmlFor={`proposal-${id}-in-kind-new-description`}>
                  {labels.description}
                </label>
                <input
                  id={`proposal-${id}-in-kind-new-description`}
                  value={adding.description}
                  onChange={(event) =>
                    setAdding({ ...adding, description: event.target.value })
                  }
                  disabled={busy}
                />
              </>
            )}
            <button
              id={`proposal-${id}-in-kind-add-save`}
              type="button"
              onClick={() => void addLine()}
              disabled={busy}
            >
              {labels.add}
            </button>
            <button
              id={`proposal-${id}-in-kind-add-cancel`}
              type="button"
              onClick={() => setAdding(null)}
              disabled={busy}
            >
              {labels.cancel}
            </button>
          </div>
        </ActionDialog>
      )}
      {confirm.element}
    </section>
  );
}
