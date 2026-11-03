"use client";
import Link from "next/link";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { DataTable } from "@/components/ui/data-table";
import { functions } from "@/lib/functions";
import type { FormatSettings } from "@/lib/format";
import type { proposalStaffCost } from "@/server/modules/proposals/budget";
import styles from "../proposal-record.module.css";

type Cost = Awaited<ReturnType<typeof proposalStaffCost>>;
type Line = Cost["lines"][number];

/** One staff cost's details and lines (legacy staff costing page), opened from the Budget tree. */
export function StaffCost({
  type,
  id,
  costHeaderId,
  version,
  cost,
  format,
}: {
  type: string;
  id: string;
  costHeaderId: string;
  version?: string;
  cost: Cost;
  format?: FormatSettings;
}) {
  const fields = [
    ["Full Name", cost.name],
    ["Employee number", cost.employeeNumber],
    ["Org Unit", cost.orgUnit],
    ["Faculty / School", cost.faculty],
    [
      "Probation end date",
      functions.format.dateDisplay(cost.probationEndDate, format),
    ],
    ["First Increment", cost.firstIncrement],
    ["Project role", cost.projectRole],
    ["Costing HDR section", cost.fundingSection],
    ["Salary Model", cost.salaryModel],
    ["HR FTE", String(cost.hrFte)],
    ["Override Inflation", cost.overrideInflation ? "Yes" : "No"],
  ];
  const showSensitive = cost.lines.some((line) => line.unitCost !== null);
  return (
    <section
      id={`proposal-${id}-staff-cost-${costHeaderId}`}
      className={styles.staffCost}
    >
      <div className={styles.staffCostTitle}>
        <h2>Staff costing</h2>
        <Link
          id={`proposal-${id}-staff-cost-back`}
          href={`/proposals/${type}/${id}/budget${version ? `?version=${version}` : ""}`}
          prefetch={false}
        >
          ← Back
        </Link>
      </div>
      <ReadonlyField
        id={`proposal-${id}-staff-cost-model`}
        className={styles.staffCostModel}
        label="Cost model"
        value={cost.costModel || "—"}
      />
      <h3>Personal details</h3>
      <div className={styles.staffFields}>
        {fields.map(([name, value], index) => (
          <ReadonlyField
            key={name}
            id={`proposal-${id}-staff-field-${index}`}
            label={name}
            value={value || "—"}
          />
        ))}
      </div>
      <h3>Cost lines</h3>
      {cost.lines.length === 0 ? (
        <p>No data to display.</p>
      ) : (
        <DataTable
          id={`proposal-${id}-staff-cost-lines`}
          rowIds={`proposal-${id}-staff-cost-line`}
          className={styles.staffLines}
          columns={[
            {
              id: "start",
              header: "Start date",
              cell: (line) =>
                functions.format.dateDisplay(line.startDate, format),
            },
            {
              id: "end",
              header: "End date",
              cell: (line) =>
                functions.format.dateDisplay(line.endDate, format),
            },
            { id: "fte", header: "FTE", cell: (line) => line.fte },
            { id: "units", header: "Units", cell: (line) => line.units },
            ...(showSensitive
              ? [
                  {
                    id: "unit-cost",
                    header: "Unit cost",
                    cell: (line: Line) => line.unitCost,
                  },
                  {
                    id: "total",
                    header: "Total cost",
                    cell: (line: Line) => line.total,
                  },
                ]
              : []),
          ]}
          rows={cost.lines}
          rowKey={(line) => String(line.id)}
        />
      )}
    </section>
  );
}
