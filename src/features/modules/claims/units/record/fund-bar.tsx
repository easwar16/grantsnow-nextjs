"use client";
import type { ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Figures } from "@/components/ui/figures";
import { HelpButton } from "@/components/ui/help-button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { claimStatusTone } from "@/shared/claims/status";
import type { Header, UnitFundBar } from "../listing/types";
import styles from "./summary.module.css";

/** A column header with its More Info (the RB row's description), as the unit record's tables show it. */
export const head = (id: string, h: Header) => (
  <>
    {h.label}
    <HelpButton id={`${id}-help`} html={h.help} />
  </>
);

/**
 * The unit record's fund bar (MR 15893, Activities and Claims tabs): the tab's filters with the category counts on
 * one row, its actions at the row's end, then the fund's status and figures.
 */
export function FundBar({
  id,
  bar,
  filters,
  actions,
  empty,
  format,
  money,
}: {
  id: string;
  bar: UnitFundBar;
  /** The fund picker and the tab's other filters. */
  filters: ReactNode;
  actions?: ReactNode;
  empty: string;
  format?: FormatSettings;
  money: (v: number | null) => string;
}) {
  const c = bar.categories;
  const tone = claimStatusTone(bar.status.value);
  return (
    <section id={`${id}-fund-bar`} className={styles.panel}>
      <div className={styles.fundBarTop}>
        <div id={`${id}-filters`} className={styles.fields}>
          {filters}
        </div>
        <div id={`${id}-categories`} className={styles.fundBarCounts}>
          <DataTable
            id={`${id}-categories-table`}
            rowIds={`${id}-category`}
            label={c.headers.category.label}
            rows={c.rows}
            rowKey={(r) => r.key}
            empty={empty}
            columns={(
              ["category", "pending", "review", "approved", "rejected"] as const
            ).map((k) => ({
              id: k,
              header: head(`${id}-categories-${k}`, c.headers[k]),
              cell: (r: (typeof c.rows)[number]) => r[k],
            }))}
          />
        </div>
        {actions && <div className={styles.fundBarActions}>{actions}</div>}
      </div>
      <hr className={styles.fundBarRule} />
      <Figures
        id={`${id}-figures`}
        items={[
          {
            key: "fund-status",
            label: bar.status.label,
            value: tone ? (
              <StatusBadge id={`${id}-fund-status`} dot tone={tone}>
                {bar.status.value}
              </StatusBadge>
            ) : (
              bar.status.value
            ),
          },
          ...bar.amounts.map((a) => ({
            key: a.key,
            label: a.label,
            value: money(a.value),
            danger: a.danger,
          })),
          ...bar.dates.map((d) => ({
            key: d.key,
            label: d.label,
            value: functions.format.dateDisplay(d.value, format),
          })),
          ...bar.grant,
        ]}
      />
    </section>
  );
}
