"use client";
import { DataTable } from "@/components/ui/data-table";
import { type FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { contractSignerStamp } from "@/features/modules/contracts/format";
import type { ContractDetail } from "@/features/modules/contracts/types";
import type { contractSigners } from "@/server/modules/contracts/service";

type Signer = Awaited<ReturnType<typeof contractSigners>>[number];
const STAMPS = new Set(["sent", "delivered", "signed"]);

/** The Signers tab's table: the RB-visible columns, with labels resolved on the server. */
export function SignersTable({
  columns,
  rows,
  format,
}: {
  columns: { key: keyof Signer; label: string }[];
  rows: Signer[];
  format?: FormatSettings;
}) {
  return (
    <DataTable
      id="contract-signers-table"
      columns={columns.map((c) => ({
        id: c.key,
        header: c.label,
        cell: (r: Signer) =>
          STAMPS.has(c.key) ? contractSignerStamp(r[c.key], format) : r[c.key],
      }))}
      rows={rows}
      // By position: an email has no place in an element id.
      rowKey={(r) => String(rows.indexOf(r))}
    />
  );
}

/** Summary's Deadline Date table. */
export function DeadlinesTable({
  id,
  rows,
  format,
}: {
  id: string;
  rows: ContractDetail["deadlines"];
  format?: FormatSettings;
}) {
  return (
    <DataTable
      id={id}
      columns={[
        { id: "type", header: "Deadline Type", cell: (d) => d.type },
        {
          id: "description",
          header: "Deadline Description",
          cell: (d) => d.description,
        },
        {
          id: "date",
          header: "Deadline date",
          cell: (d) => functions.format.dateDisplay(d.date, format),
        },
        {
          id: "reminder",
          header: "Remind me before",
          cell: (d) => d.reminderDays,
        },
      ]}
      rows={rows}
      rowKey={(d) => String(rows.indexOf(d))}
      empty="No data to display."
    />
  );
}
