"use client";
import { Fragment, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { InsightChart } from "@/features/modules/home/components/insight-chart";
import { type FormatSettings } from "@/lib/format";
import { reportTotals, type ReportView } from "./report-model";
import styles from "./tabs.module.css";
import { functions } from "@/lib/functions";

const YEAR_COLUMNS = ["budget", "actual", "variance", "forecast"] as const;

/** The Project Report tab (legacy awards-report): totals, the yearly chart and table, and actuals by month. */
export function ReportTab({
  view,
  format,
}: {
  view: ReportView;
  format?: FormatSettings & { currency?: string };
}) {
  const t = view.texts;
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setClosed((c) => {
      const next = new Set(c);
      if (!next.delete(key)) next.add(key);
      return next;
    });
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
          <table className="gn-table">
            <thead>
              <tr>
                <th scope="col">{t.costPeriod}</th>
                {YEAR_COLUMNS.map((k) => (
                  <th key={k} scope="col" className={styles.number}>
                    {t[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.years.map((y) => (
                <tr key={y.cost_period}>
                  <td>{y.cost_period}</td>
                  {YEAR_COLUMNS.map((k) => (
                    <td key={k} className={styles.number}>
                      {money(y[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>{t.total}</strong>
                </td>
                {YEAR_COLUMNS.map((k) => (
                  <td key={k} className={styles.number}>
                    <strong>{money(totals[k])}</strong>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
      <section id="award-report-months" className={styles.periods}>
        <h2>{t.monthly}</h2>
        <div className="gn-table-scroll">
          <table className="gn-table">
            <thead>
              <tr>
                <th scope="col">{t.name}</th>
                {view.months.columns.map((c) => (
                  <th key={c.key} scope="col" className={styles.number}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.months.rows.map((h) => (
                <Fragment key={h.id}>
                  {/* Legacy tMonthlySplit depth 0: expander and name over all but the last two columns, which hold the total. */}
                  <tr
                    id={`award-report-month-${functions.ids.idPart(String(h.id))}`}
                  >
                    <th
                      scope="row"
                      colSpan={Math.max(view.months.columns.length - 1, 1)}
                    >
                      <span className={styles.node}>
                        <button
                          type="button"
                          id={`award-report-month-${functions.ids.idPart(String(h.id))}-toggle`}
                          className={styles.expander}
                          aria-expanded={!closed.has(String(h.id))}
                          aria-label={h.name}
                          onClick={() => toggle(String(h.id))}
                        >
                          <Icon name="caret-down" size={14} />
                        </button>
                        <span className={styles.nodeName}>{h.name}</span>
                      </span>
                    </th>
                    <td
                      colSpan={2}
                      className={`${styles.number} ${styles.strong}`}
                    >
                      {money(h.total)}
                    </td>
                  </tr>
                  {(closed.has(String(h.id)) ? [] : h.children).map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      {view.months.columns.map((col) => (
                        <td key={col.key} className={styles.number}>
                          {money(c.values[col.key] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {view.months.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={view.months.columns.length + 1}
                    className="gn-table-empty"
                  >
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
