"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { Collapsible } from "@/components/ui/collapsible";
import { DataTable } from "@/components/ui/data-table";
import { DateInput } from "@/components/ui/date-input";
import { Select, type SelectOption } from "@/components/ui/select";
import { proposals } from "@/lib/api";
import { functions } from "@/lib/functions";
import type { FormattingConfiguration } from "@/server/platform/configuration/formatting";
import type { proposalResearchPartnerCosts } from "@/server/modules/proposals/record/research-partner-costs";
import styles from "./proposal-record.module.css";

type Data = Awaited<ReturnType<typeof proposalResearchPartnerCosts>>;
type Line = Data["lines"][number];
type Labels = Record<
  | "start"
  | "end"
  | "category"
  | "item"
  | "description"
  | "cost"
  | "save"
  | "cancel",
  string
>;

export function ResearchPartnerCosts({
  type,
  id,
  headers,
  lines,
  categories,
  canEdit,
  canDelete,
  labels,
  format,
}: {
  type: string;
  id: string;
  headers: Data["headers"];
  lines: Line[];
  categories: Data["categories"];
  canEdit: boolean;
  canDelete: boolean;
  labels: Labels;
  format?: FormattingConfiguration;
}) {
  const router = useRouter();
  const confirm = useConfirm(`proposal-${id}-partner-cost-delete-dialog`);
  const [draft, setDraft] = useState<{
    id: number;
    startDate: string;
    endDate: string;
    description: string;
    cost: string;
  } | null>(null);
  const [newCost, setNewCost] = useState<{
    relationId: number;
    category: string;
    itemCode: string;
    description: string;
    cost: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [items, setItems] = useState<SelectOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const money = (value: number) =>
    functions.format.moneyDisplay(String(value), format?.currency, format);
  const save = async () => {
    if (!draft || busy) return;
    const cost = Number(draft.cost);
    if (
      !draft.startDate ||
      !draft.endDate ||
      draft.endDate < draft.startDate ||
      draft.cost.trim() === "" ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      setError("Enter valid dates and cost.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await proposals.saveResearchPartnerCost(type, id, {
      ...draft,
      cost,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDraft(null);
    router.refresh();
  };
  const remove = async (line: Line) => {
    if (
      busy ||
      !(await confirm.ask({
        title: "Delete Research Partner Cost",
        message: `Delete ${line.description || line.item}?`,
        confirm: "Delete",
        cancel: labels.cancel,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    const result = await proposals.removeResearchPartnerCost(type, id, line.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };
  const chooseCategory = async (category: string) => {
    if (!newCost) return;
    setNewCost({ ...newCost, category, itemCode: "" });
    setItems([]);
    setError("");
    if (!category) return;
    const result = await proposals.researchPartnerCostItems(type, id, category);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setItems(result.data);
  };
  const add = async () => {
    if (!newCost || busy) return;
    const cost = Number(newCost.cost);
    if (
      !newCost.category ||
      !newCost.itemCode ||
      !newCost.startDate ||
      !newCost.endDate ||
      newCost.endDate < newCost.startDate ||
      newCost.cost.trim() === "" ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      setError(
        "Select a cost category and item, then enter valid dates and cost.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const result = await proposals.addResearchPartnerCost(type, id, {
      ...newCost,
      cost,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNewCost(null);
    router.refresh();
  };
  return (
    <section
      id={`proposal-${id}-research-partner-costs`}
      className={styles.creditAllocation}
    >
      {error && (
        <p id={`proposal-${id}-research-partner-cost-error`} role="alert">
          {error}
        </p>
      )}
      {headers.length === 0 && <p>No data to display.</p>}
      {headers.map((partner) => (
        <Collapsible
          key={partner.id}
          id={`proposal-${id}-partner-cost-${partner.relationId}`}
          heading={`${partner.name} — ${money(partner.total)}`}
          defaultOpen
        >
          {canEdit && (
            <button
              id={`proposal-${id}-partner-cost-add-${partner.relationId}`}
              type="button"
              disabled={busy}
              onClick={() => {
                setNewCost({
                  relationId: partner.relationId,
                  category: "",
                  itemCode: "",
                  description: "",
                  cost: "0",
                  startDate: "",
                  endDate: "",
                });
                setItems([]);
                setError("");
              }}
            >
              Add Cost
            </button>
          )}
          <DataTable
            id={`proposal-${id}-partner-cost-lines-${partner.relationId}`}
            rowIds={`proposal-${id}-partner-cost-line`}
            rows={lines.filter(
              (line) => line.relationId === partner.relationId,
            )}
            rowKey={(line) => String(line.id)}
            columns={[
              {
                id: "start",
                header: labels.start,
                cell: (line: Line) =>
                  functions.format.dateDisplay(line.startDate, format),
              },
              {
                id: "end",
                header: labels.end,
                cell: (line: Line) =>
                  functions.format.dateDisplay(line.endDate, format),
              },
              {
                id: "category",
                header: labels.category,
                cell: (line: Line) => line.category,
              },
              {
                id: "item",
                header: labels.item,
                cell: (line: Line) => line.item,
              },
              {
                id: "description",
                header: labels.description,
                cell: (line: Line) => line.description,
              },
              {
                id: "cost",
                header: labels.cost,
                cell: (line: Line) => money(line.cost),
              },
            ]}
            actions={
              canEdit || canDelete
                ? [
                    ...(canEdit
                      ? [
                          {
                            id: "edit",
                            icon: "edit" as const,
                            label: (line: Line) =>
                              `Edit ${line.description || line.item}`,
                            onClick: (line: Line) => {
                              setDraft({
                                id: line.id,
                                startDate: line.startDate,
                                endDate: line.endDate,
                                description: line.description,
                                cost: String(line.cost),
                              });
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
                            label: (line: Line) =>
                              `Delete ${line.description || line.item}`,
                            onClick: (line: Line) => void remove(line),
                            disabled: () => busy,
                          },
                        ]
                      : []),
                  ]
                : undefined
            }
            empty="No data to display."
          />
        </Collapsible>
      ))}
      {newCost && (
        <ActionDialog
          id={`proposal-${id}-partner-cost-add-dialog`}
          title="Add Research Partner Cost"
          onClose={() => setNewCost(null)}
        >
          <div className={styles.staffEntryFields}>
            <Select
              id={`proposal-${id}-partner-cost-category`}
              label={labels.category}
              options={categories}
              value={newCost.category}
              onChange={(category) => void chooseCategory(category)}
              disabled={busy}
            />
            <Select
              id={`proposal-${id}-partner-cost-item`}
              label={labels.item}
              options={items}
              value={newCost.itemCode}
              onChange={(itemCode) => setNewCost({ ...newCost, itemCode })}
              disabled={busy || !newCost.category}
            />
            <DateInput
              id={`proposal-${id}-partner-cost-new-start`}
              label={labels.start}
              value={newCost.startDate}
              onChange={(startDate) => setNewCost({ ...newCost, startDate })}
              disabled={busy}
            />
            <DateInput
              id={`proposal-${id}-partner-cost-new-end`}
              label={labels.end}
              value={newCost.endDate}
              onChange={(endDate) => setNewCost({ ...newCost, endDate })}
              disabled={busy}
            />
            <label htmlFor={`proposal-${id}-partner-cost-new-description`}>
              {labels.description}
            </label>
            <input
              id={`proposal-${id}-partner-cost-new-description`}
              value={newCost.description}
              onChange={(event) =>
                setNewCost({ ...newCost, description: event.target.value })
              }
              disabled={busy}
            />
            <label htmlFor={`proposal-${id}-partner-cost-new-amount`}>
              {labels.cost}
            </label>
            <input
              id={`proposal-${id}-partner-cost-new-amount`}
              type="number"
              min="0"
              step="any"
              value={newCost.cost}
              onChange={(event) =>
                setNewCost({ ...newCost, cost: event.target.value })
              }
              disabled={busy}
            />
            <button
              id={`proposal-${id}-partner-cost-add-save`}
              type="button"
              onClick={() => void add()}
              disabled={busy}
            >
              {labels.save}
            </button>
            <button
              id={`proposal-${id}-partner-cost-add-cancel`}
              type="button"
              onClick={() => setNewCost(null)}
              disabled={busy}
            >
              {labels.cancel}
            </button>
          </div>
        </ActionDialog>
      )}
      {draft && (
        <ActionDialog
          id={`proposal-${id}-partner-cost-edit-dialog`}
          title="Edit Research Partner Cost"
          onClose={() => setDraft(null)}
        >
          <div className={styles.staffEntryFields}>
            <DateInput
              id={`proposal-${id}-partner-cost-start`}
              label={labels.start}
              value={draft.startDate}
              onChange={(startDate) => setDraft({ ...draft, startDate })}
              disabled={busy}
            />
            <DateInput
              id={`proposal-${id}-partner-cost-end`}
              label={labels.end}
              value={draft.endDate}
              onChange={(endDate) => setDraft({ ...draft, endDate })}
              disabled={busy}
            />
            <label htmlFor={`proposal-${id}-partner-cost-description`}>
              {labels.description}
            </label>
            <input
              id={`proposal-${id}-partner-cost-description`}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              disabled={busy}
            />
            <label htmlFor={`proposal-${id}-partner-cost-amount`}>
              {labels.cost}
            </label>
            <input
              id={`proposal-${id}-partner-cost-amount`}
              type="number"
              min="0"
              step="any"
              value={draft.cost}
              onChange={(event) =>
                setDraft({ ...draft, cost: event.target.value })
              }
              disabled={busy}
            />
            <button
              id={`proposal-${id}-partner-cost-save`}
              type="button"
              onClick={() => void save()}
              disabled={busy}
            >
              {labels.save}
            </button>
            <button
              id={`proposal-${id}-partner-cost-cancel`}
              type="button"
              onClick={() => setDraft(null)}
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
