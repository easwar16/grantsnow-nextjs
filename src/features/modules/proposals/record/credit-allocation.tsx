"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { functions } from "@/lib/functions";
import { proposals } from "@/lib/api";
import { useToast } from "@/components/feedback/toast";
import type { FormatSettings } from "@/lib/format";
import type { proposalCreditAllocation } from "@/server/modules/proposals/credit-allocation";
import styles from "./proposal-record.module.css";

type Row = Awaited<ReturnType<typeof proposalCreditAllocation>>["rows"][number];
export type CreditColumn = {
  key: string;
  label: string;
  field: "name" | "proposalNumber" | "role" | "orgUnit" | "effort" | "credit";
};

/** Effort and credit are fractions; credit keeps its fixed digits, as legacy's converters show them. */
function percent(
  value: string | number,
  format: FormatSettings | undefined,
  fixed: boolean,
) {
  if (value === "") return "";
  const number = Number(value);
  return Number.isFinite(number)
    ? functions.format.percentDisplay(number, format, fixed)
    : String(value);
}

/** The Credit Allocation tab's table: the RB-visible columns the page passes, in legacy order. */
export function CreditAllocation({
  type,
  id,
  rows,
  versionId,
  canEdit,
  labels,
  columns,
  format,
}: {
  type: string;
  id: string;
  rows: Row[];
  versionId: number | null;
  canEdit: boolean;
  labels: { edit: string; save: string; cancel: string };
  columns: CreditColumn[];
  format?: FormatSettings;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<number | null>(null);
  const [effort, setEffort] = useState("");
  const [credit, setCredit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{
    field: CreditColumn["field"];
    descending: boolean;
  } | null>(null);
  const edit = (row: Row) => {
    setEditing(row.id);
    setEffort(row.effort === "" ? "" : String(Number(row.effort) * 100));
    setCredit(String(Number(row.credit) * 100));
    setError("");
  };
  const save = async () => {
    if (editing === null || versionId === null || busy) return;
    const effortValue = Number(effort) / 100;
    const creditValue = Number(credit) / 100;
    if (
      effort.trim() === "" ||
      credit.trim() === "" ||
      !Number.isFinite(effortValue) ||
      !Number.isFinite(creditValue) ||
      effortValue < 0 ||
      effortValue > 1 ||
      creditValue < 0 ||
      creditValue > 1
    ) {
      setError("Enter percentages from 0 to 100.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await proposals.saveCreditAllocation(
        type,
        id,
        versionId,
        rows.map((row) => ({
          id: row.id,
          effort:
            row.id === editing
              ? effortValue
              : row.effort === ""
                ? null
                : Number(row.effort),
          credit: row.id === editing ? creditValue : Number(row.credit),
        })),
      );
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setEditing(null);
      toast.show("success", "Saved", "Credit Allocation saved.", false);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Credit Allocation could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    if (busy) return;
    setEditing(null);
    setError("");
  };
  const sortedRows = sort
    ? [...rows].sort((left, right) => {
        const a = left[sort.field];
        const b = right[sort.field];
        const result =
          sort.field === "effort" || sort.field === "credit"
            ? Number(a) - Number(b)
            : String(a).localeCompare(String(b));
        return sort.descending ? -result : result;
      })
    : rows;
  return (
    <section
      id={`proposal-${id}-credit-allocation`}
      className={styles.creditAllocation}
    >
      <DataTable
        id={`proposal-${id}-credit-allocation-table`}
        rowIds={`proposal-${id}-credit-allocation`}
        className={
          columns.length === 6
            ? styles.creditAllocationTable
            : styles.staffLines
        }
        columns={columns.map(({ key, label, field }) => ({
          id: key,
          header: (
            <button
              id={`proposal-${id}-credit-allocation-header-${key}`}
              type="button"
              className={styles.creditAllocationSort}
              aria-label={`Sort by ${label}`}
              onClick={() =>
                setSort((current) => ({
                  field,
                  descending: current?.field === field && !current.descending,
                }))
              }
            >
              <span className={styles.creditAllocationSortLabel}>{label}</span>
              <span className={styles.creditAllocationSortIcons}>
                <Icon name="chevron-up" size={11} />
                <Icon name="chevron-down" size={11} />
              </span>
            </button>
          ),
          cell: (row: Row) => (
            <span
              id={
                editing === row.id && field === "credit"
                  ? `proposal-${id}-credit-allocation-editor`
                  : `proposal-${id}-credit-allocation-${row.id}-${key}`
              }
            >
              {editing === row.id &&
              (field === "effort" || field === "credit") ? (
                <input
                  id={`proposal-${id}-credit-allocation-${field}`}
                  className={styles.creditAllocationInput}
                  aria-label={label}
                  aria-invalid={!!error}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  title={`${labels.cancel} (Escape)`}
                  value={field === "effort" ? effort : credit}
                  onChange={(event) =>
                    field === "effort"
                      ? setEffort(event.target.value)
                      : setCredit(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") cancel();
                    if (event.key === "Enter") void save();
                  }}
                  disabled={busy}
                />
              ) : field === "effort" || field === "credit" ? (
                percent(row[field], format, field === "credit")
              ) : (
                row[field]
              )}
            </span>
          ),
        }))}
        rows={sortedRows}
        rowKey={(row) => String(row.id)}
        actions={
          canEdit
            ? [
                {
                  id: "edit",
                  icon: "edit",
                  label: (row) =>
                    `${labels.edit} Credit Allocation for ${row.name}`,
                  onClick: edit,
                  disabled: () => busy,
                  hidden: (row) => row.id === editing,
                },
              ]
            : undefined
        }
        actionCell={
          canEdit
            ? (row) =>
                row.id === editing ? (
                  <button
                    id={`proposal-${id}-credit-allocation-save`}
                    type="button"
                    className="gn-btn gn-btn--borderless gn-btn--icon"
                    aria-label={`${labels.save} Credit Allocation for ${row.name}`}
                    title={labels.save}
                    onClick={() => void save()}
                    disabled={busy}
                  >
                    <Icon name="save" size={16} />
                  </button>
                ) : null
            : undefined
        }
        empty="No data to display."
      />
      {editing !== null && error && (
        <p id={`proposal-${id}-credit-allocation-error`} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
