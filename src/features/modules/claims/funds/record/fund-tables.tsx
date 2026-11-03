"use client";
import { DataTable } from "@/components/ui/data-table";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import type {
  FundActivityRow,
  FundClaimLineRow,
  FundSummary,
  FundTableView,
} from "../types";
import { FundSummaryTable } from "../fund-summary-table";
import styles from "./record.module.css";

type Format = FormatSettings & { currency?: string };
const money = (v: number | null, format?: Format) =>
  v === null
    ? ""
    : functions.format.moneyDisplay(String(v), format?.currency, format);

/** The Summary tab (legacy claims-funds-summary). */
export function FundSummaryTab({
  summary,
  format,
}: {
  summary: FundSummary;
  format?: Format;
}) {
  return (
    <div className={styles.panel}>
      <FundSummaryTable
        id="claims-fund-summary"
        summary={summary}
        format={format}
      />
    </div>
  );
}

/** The Budget tab (legacy claims-funds-budget): the fund's activities for the filter bar's function and object. */
export function FundBudgetTab({
  view,
  format,
}: {
  view: FundTableView<FundActivityRow>;
  format?: Format;
}) {
  const h = view.headers;
  return (
    <div className={styles.panel}>
      <DataTable
        id="claims-fund-budget"
        rowIds="claims-fund-activity"
        label={h.number}
        rows={view.rows}
        rowKey={(r) => r.key}
        columns={[
          {
            id: "number",
            header: h.number,
            rowHeader: true,
            cell: (r) => r.number,
          },
          { id: "type", header: h.type, cell: (r) => r.type },
          { id: "status", header: h.status, cell: (r) => r.status },
          {
            id: "cost",
            header: h.cost,
            cell: (r) => money(r.cost, format),
          },
          {
            id: "itemization",
            header: h.itemization,
            cell: (r) => r.itemization,
          },
          { id: "job", header: h.job, cell: (r) => r.job },
        ]}
        empty={view.empty}
      />
    </div>
  );
}

/** The Claims tab (legacy claims-funds-claims): claim lines for the filter bar's function, object and status. */
export function FundClaimsTab({
  view,
  format,
}: {
  view: FundTableView<FundClaimLineRow>;
  format?: Format;
}) {
  const h = view.headers;
  return (
    <div className={styles.panel}>
      <DataTable
        id="claims-fund-claims"
        rowIds="claims-fund-claim-line"
        label={h.number}
        rows={view.rows}
        rowKey={(r) => r.key}
        columns={[
          {
            id: "number",
            header: h.number,
            rowHeader: true,
            cell: (r) => r.number,
          },
          { id: "period", header: h.period, cell: (r) => r.period },
          {
            id: "date",
            header: h.date,
            cell: (r) => r.date && functions.format.dateDisplay(r.date, format),
          },
          { id: "status", header: h.status, cell: (r) => r.status },
          {
            id: "amount",
            header: h.amount,
            cell: (r) => money(r.amount, format),
          },
          {
            id: "description",
            header: h.description,
            cell: (r) => r.description,
          },
        ]}
        empty={view.empty}
      />
    </div>
  );
}
