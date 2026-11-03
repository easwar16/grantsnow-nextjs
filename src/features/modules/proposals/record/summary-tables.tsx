"use client";
import { DataTable } from "@/components/ui/data-table";
import { functions } from "@/lib/functions";
import type { FormatSettings } from "@/lib/format";
import type { ProposalSummary } from "@/features/modules/proposals/record";
import styles from "./proposal-record.module.css";

type Labels = ProposalSummary["labels"];

/** The Summary's read-only Funders table; its row actions stay disabled outside edit mode, as legacy shows them. */
export function SponsorsTable({
  id,
  rows,
  labels,
}: {
  id: string;
  rows: ProposalSummary["sponsors"];
  labels: Labels;
}) {
  return (
    <DataTable
      id={`${id}-sponsors-table`}
      rowIds={`${id}-sponsor`}
      columns={[
        { id: "funder", header: labels.funder, cell: (s) => s.name },
        ...(labels.funderTypeVisible
          ? [
              {
                id: "funder-type",
                header: labels.funderType,
                cell: (s: (typeof rows)[number]) => s.funderType,
              },
            ]
          : []),
        { id: "role", header: labels.funderRole, cell: (s) => s.type },
        { id: "priority", header: labels.priority, cell: (s) => s.priority },
      ]}
      rows={rows}
      rowKey={(s) => String(s.id)}
      actions={[
        {
          id: "edit",
          icon: "edit",
          label: (s) => `Edit ${s.name}`,
          disabled: () => true,
          onClick: () => undefined,
        },
        {
          id: "delete",
          icon: "trash",
          label: (s) => `Delete ${s.name}`,
          disabled: () => true,
          onClick: () => undefined,
        },
      ]}
      actionsClassName={styles.summaryRowActions}
      empty={<span className={styles.summaryEmpty}>{labels.noData}</span>}
    />
  );
}

export function DeadlinesTable({
  id,
  rows,
  noData,
  format,
}: {
  id: string;
  rows: ProposalSummary["deadlines"];
  noData: string;
  format?: FormatSettings;
}) {
  return (
    <DataTable
      id={`${id}-deadlines-table`}
      rowIds={`${id}-deadline`}
      columns={[
        { id: "type", header: "Deadline type", cell: (d) => d.type },
        {
          id: "description",
          header: "Deadline Description",
          cell: (d) => d.description,
        },
        {
          id: "date",
          header: "Deadline Date",
          cell: (d) => functions.format.dateDisplay(d.date, format),
        },
      ]}
      rows={rows}
      rowKey={(d) => String(d.id)}
      empty={<span className={styles.summaryEmpty}>{noData}</span>}
    />
  );
}

export function CollaboratorsTable({
  id,
  rows,
}: {
  id: string;
  rows: ProposalSummary["collaborators"];
}) {
  return (
    <DataTable
      id={`${id}-collaborators-table`}
      rowIds={`${id}-collaborator`}
      columns={[
        { id: "name", header: "Research Partner", cell: (r) => r.name },
        { id: "role", header: "Role", cell: (r) => r.role },
        {
          id: "description",
          header: "Description",
          cell: (r) => r.description,
        },
        { id: "country", header: "Country Code", cell: (r) => r.countryCode },
        { id: "vat", header: "Vat Code", cell: (r) => r.vatCode },
        {
          id: "cost-enabled",
          header: "Cost Enabled",
          cell: (r) => (
            <input
              id={`${id}-collaborator-${r.id}-cost-enabled`}
              type="checkbox"
              aria-label={`${r.name} cost enabled`}
              checked={r.costingEnabled}
              readOnly
              disabled
            />
          ),
        },
      ]}
      rows={rows}
      rowKey={(r) => String(r.id)}
    />
  );
}

export function SubproposalsTable({
  id,
  rows,
}: {
  id: string;
  rows: ProposalSummary["subproposals"];
}) {
  return (
    <DataTable
      id={`${id}-subprojects-table`}
      rowIds={`${id}-subproject`}
      columns={[
        { id: "type", header: "Type", cell: (r) => r.type },
        { id: "name", header: "Name", cell: (r) => r.name },
        { id: "org-unit", header: "Org Unit", cell: (r) => r.orgUnit },
        { id: "role", header: "Role", cell: (r) => r.role },
        {
          id: "exclude-pricing",
          header: "Exclude Pricing",
          cell: (r) => (
            <input
              id={`${id}-subproject-${r.id}-exclude-pricing`}
              type="checkbox"
              aria-label={`${r.name} exclude pricing`}
              checked={r.excludePricing}
              readOnly
              disabled
            />
          ),
        },
        {
          id: "proposal-number",
          header: "Proposal Number",
          cell: (r) => r.proposalNumber,
        },
      ]}
      rows={rows}
      rowKey={(r) => String(r.id)}
    />
  );
}
