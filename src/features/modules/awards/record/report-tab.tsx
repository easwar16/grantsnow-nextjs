"use client";
import { DataTable } from "@/components/ui/data-table";
import { InsightChart } from "@/features/modules/home/components/insight-chart";
import { type FormatSettings } from "@/lib/format";
import {
  reportTotals,
  type ReportMonth,
  type ReportView,
} from "./report-model";
import styles from "./tabs.module.css";
import { functions } from "@/lib/functions";

const YEAR_COLUMNS = ["budget", "actual", "variance", "forecast"] as const;
/** A funding header (with `head`) or one of its lines, as the monthly tree's rows. */
type MonthRow = {
  id: string;
  name: string;
  head?: ReportMonth;
  parent?: string;
  values?: Record<string, number>;
};

/** The Project Report tab (legacy awards-report): totals, the yearly chart and table, and actuals by month. */
export function ReportTab({
  view,
  format,
}: {
  view: ReportView;
  format?: FormatSettings & { currency?: string };
}) {
  const t = view.texts;
  const months = view.months.columns.length;
  const money = (v: number) =>
    functions.format.moneyDisplay(String(v), format?.currency, format);
  if (view.project === null)
    return (
      <div id="award-record-report" className={styles.tab}>
        <p className={styles.empty}>{t.noData}</p>
      </div>
    );
  const totals = reportTotals(view.years);
  return (
    <div id="award-record-report" className={styles.tab}>
      <div className={styles.reportTop}>
        <dl id="award-report-totals" className={styles.tile}>
          <div>
            <dt>{t.projectNumber}</dt>
            <dd>{view.project}</dd>
          </div>
          <div>
            <dt>{t.totalBudget}</dt>
            <dd>{money(totals.budget)}</dd>
          </div>
          <div>
            <dt>{t.ptdTotal}</dt>
            <dd>{money(totals.actual)}</dd>
          </div>
        </dl>
        <section id="award-report-chart" className={styles.tile}>
          <h2>{t.chart}</h2>
          {view.chart.length === 0 ? (
            <p className={styles.empty}>{t.noData}</p>
          ) : (
            <InsightChart
              id="award-report-chart-view"
              title={t.chart}
              format={format}
              data={{
                attention: [],
                statistics: view.chart,
                hasMore: false,
                offset: 0,
                presentation: {
                  type: "bar",
                  columns: 12,
                  currency: format?.currency,
                  legend: true,
                },
              }}
            />
          )}
        </section>
        <section id="award-report-years" className={styles.tile}>
          <h2>{t.table}</h2>
          <DataTable
            id="award-report-years-table"
            columns={[
              {
                id: "period",
                header: t.costPeriod,
                cell: (y) => y.cost_period,
                footer: <strong>{t.total}</strong>,
              },
              ...YEAR_COLUMNS.map((k) => ({
                id: k,
                header: t[k],
                align: "end" as const,
                cell: (y: ReportView["years"][number]) => money(y[k]),
                footer: <strong>{money(totals[k])}</strong>,
              })),
            ]}
            rows={view.years}
            rowKey={(y) => String(y.cost_period)}
          />
        </section>
      </div>
      <section id="award-report-months" className={styles.periods}>
        <h2>{t.monthly}</h2>
        <DataTable<MonthRow>
          id="award-report-months-table"
          rowIds="award-report-month"
          height="default"
          rows={view.months.rows.map((m) => ({
            head: m,
            id: m.id,
            name: m.name,
          }))}
          rowKey={(r) => (r.head ? r.id : `${r.parent}-${r.id}`)}
          childrenOf={(r) =>
            r.head?.children.map((c) => ({ ...c, parent: r.id }))
          }
          rowLabel={(r) => r.name}
          columns={[
            {
              id: "name",
              header: t.name,
              // Legacy tMonthlySplit depth 0: the name over all but the last two columns, which hold the total.
              span: (r) => (r.head ? Math.max(months - 1, 1) : 1),
              cell: (r) =>
                r.head ? (
                  <span className={styles.nodeName}>{r.name}</span>
                ) : (
                  r.name
                ),
            },
            ...view.months.columns.map((col, i) => ({
              id: col.key,
              header: col.label,
              className: styles.number,
              span: (r: MonthRow) =>
                r.head && i === Math.max(months - 2, 0)
                  ? Math.min(2, months - i)
                  : 1,
              cell: (r: MonthRow) =>
                r.head ? (
                  <strong>{money(r.head.total)}</strong>
                ) : (
                  money(r.values?.[col.key] ?? 0)
                ),
            })),
          ]}
          empty={t.noData}
        />
      </section>
    </div>
  );
}
