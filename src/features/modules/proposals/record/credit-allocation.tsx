"use client";
import { DataTable } from "@/components/ui/data-table";
import { functions } from "@/lib/functions";
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
  id,
  rows,
  columns,
  format,
}: {
  id: string;
  rows: Row[];
  columns: CreditColumn[];
  format?: FormatSettings;
}) {
  return (
    <section
      id={`proposal-${id}-credit-allocation`}
      className={styles.creditAllocation}
    >
      <DataTable
        id={`proposal-${id}-credit-allocation-table`}
        rowIds={`proposal-${id}-credit-allocation`}
        className={styles.staffLines}
        columns={columns.map(({ key, label, field }) => ({
          id: key,
          header: (
            <span id={`proposal-${id}-credit-allocation-header-${key}`}>
              {label}
            </span>
          ),
          cell: (row: Row) => (
            <span id={`proposal-${id}-credit-allocation-${row.id}-${key}`}>
              {field === "effort" || field === "credit"
                ? percent(row[field], format, field === "credit")
                : row[field]}
            </span>
          ),
        }))}
        rows={rows}
        rowKey={(row) => String(row.id)}
        empty="No data to display."
      />
    </section>
  );
}
