"use client";
import { DataTable } from "@/components/ui/data-table";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import type { FundSummary, FundSummaryRow } from "./types";

/** A fund's account summary per function and object (the listing's Summary dialog and the record's Summary tab). */
export function FundSummaryTable({
  id,
  summary,
  format,
  height,
}: {
  id: string;
  summary: FundSummary;
  format?: FormatSettings & { currency?: string };
  height?: "default" | "dialog";
}) {
  const h = summary.headers;
  const money = (v: number | null) =>
    v === null
      ? ""
      : functions.format.moneyDisplay(String(v), format?.currency, format);
  const amount = (
    key: string,
    header: string,
    pick: (r: FundSummaryRow) => number | null,
  ) => ({
    id: key,
    header,
    cell: (r: FundSummaryRow) => money(pick(r)),
  });
  return (
    <DataTable
      id={id}
      rowIds={`${id}-row`}
      label={summary.title}
      height={height}
      rows={summary.rows}
      rowKey={(r) => r.key}
      columns={[
        {
          id: "function",
          header: h.func,
          rowHeader: true,
          cell: (r) => r.func,
        },
        { id: "object", header: h.object, cell: (r) => r.object },
        { id: "year", header: h.year, cell: (r) => r.year },
        amount("original", h.original, (r) => r.original),
        amount("approved", h.approved, (r) => r.approved),
        amount("in-process", h.inProcess, (r) => r.inProcess),
        amount("claimed", h.claimed, (r) => r.claimed),
        {
          id: "spent",
          header: h.spent,
          cell: (r) =>
            r.spent === null
              ? ""
              : functions.format.percentDisplay(r.spent, format),
        },
        amount("available", h.available, (r) => r.available),
      ]}
      empty={summary.empty}
    />
  );
}
