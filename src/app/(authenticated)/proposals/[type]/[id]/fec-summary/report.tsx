"use client";
import { useEffect, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { proposals } from "@/lib/api";
import styles from "./report.module.css";

type Row = Record<string, string | number | boolean | null>;
type Report = { rows: Row[]; chart: { name: string; types: string[] } };
const supported = [
  "pie",
  "bar",
  "line",
  "area",
  "lineWithArea",
  "funnel",
  "scatter",
];
const title = (key: string) =>
  key
    .split(/[-,_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
function Chart({
  id,
  rows,
  x,
  y,
  kind,
}: {
  id: string;
  rows: Row[];
  x: string[];
  y: string[];
  kind: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element || !rows.length || !x.length || !y.length) return;
    let chart: import("echarts/core").ECharts | undefined;
    let disposed = false;
    setFailed(false);
    const groups = rows.map((row) =>
      x.map((key) => String(row[key] ?? "")).join(" | "),
    );
    const series = y.map((key) => ({
      name: title(key),
      values: rows.map((row) => Number(row[key]) || 0),
    }));
    const option: EChartsOption =
      kind === "pie" || kind === "funnel"
        ? {
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [
              {
                type: kind,
                data: groups.map((name, index) => ({
                  name,
                  value: series[0].values[index],
                })),
              },
            ],
          }
        : {
            tooltip: { trigger: "axis" },
            legend: { bottom: 0 },
            xAxis: { type: "category", data: groups },
            yAxis: { type: "value" },
            series: series.map((item) => ({
              name: item.name,
              type:
                kind === "scatter"
                  ? "scatter"
                  : kind === "bar"
                    ? "bar"
                    : "line",
              areaStyle:
                kind === "area" || kind === "lineWithArea" ? {} : undefined,
              data: item.values,
            })),
          };
    option.aria = {
      enabled: true,
      label: {
        description: "Costing analysis values are listed in the data table.",
      },
    };
    void import("@/features/modules/home/components/chart-engine")
      .then(({ renderChart }) => {
        if (!disposed) chart = renderChart(element, option);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    const observer = new ResizeObserver(() => chart?.resize());
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      chart?.dispose();
    };
  }, [rows, x, y, kind]);
  return (
    <>
      <div
        id={id}
        ref={host}
        className={styles.chartCanvas}
        role="img"
        aria-label="Costing analysis chart"
      />
      {failed && (
        <p role="status">
          Chart unavailable. The data table remains available.
        </p>
      )}
    </>
  );
}

export function FecReport({
  id,
  type,
  suggestions,
  labels,
  currency,
  decimals,
}: {
  id: string;
  type: string;
  suggestions: string[];
  currency: string;
  decimals: number;
  labels: {
    title: string;
    generate: string;
    frequent: string;
    table: string;
    chart: string;
    empty: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("");
  const [x, setX] = useState<string[]>([]);
  const [y, setY] = useState<string[]>([]);
  const rows = report?.rows ?? [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const visible = rows.filter((row) =>
    Object.entries(filters).every(
      ([key, value]) =>
        !value.trim() ||
        String(row[key] ?? "")
          .toLowerCase()
          .includes(value.toLowerCase().trim()),
    ),
  );
  const chartTypes = (report?.chart.types ?? []).filter((value) =>
    supported.includes(value),
  );
  const generate = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await proposals.costingAnalysis(type, id, query);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const next = result.data;
    setReport(next);
    setFilters({});
    const keys = next.rows.length ? Object.keys(next.rows[0]) : [];
    const numeric = keys.filter((key) => typeof next.rows[0][key] === "number");
    const names = keys.filter((key) => !numeric.includes(key));
    const preferred = names.find((key) =>
      ["year", "period", "date", "name", "title"].some((hint) =>
        key.toLowerCase().includes(hint),
      ),
    );
    setX(
      preferred ? [preferred] : names.length ? [names[0]] : keys.slice(0, 1),
    );
    setY([
      ...numeric.filter((key) => key.toLowerCase().includes("cost")),
      ...numeric.filter((key) => !key.toLowerCase().includes("cost")),
    ]);
    setKind(next.chart.types.find((value) => supported.includes(value)) ?? "");
  };
  return (
    <section id={`proposal-${id}-fec-summary`} className={styles.root}>
      <div className={styles.queryPanel}>
        <div>
          <label htmlFor={`proposal-${id}-fec-query`}>{labels.title}</label>
          <textarea
            id={`proposal-${id}-fec-query`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={4}
            maxLength={2000}
          />
          <div className={styles.actions}>
            <button
              id={`proposal-${id}-fec-generate`}
              type="button"
              disabled={busy || !query.trim()}
              onClick={() => void generate()}
            >
              {busy ? "Generating…" : labels.generate}
            </button>
            <button
              id={`proposal-${id}-fec-clear-query`}
              type="button"
              disabled={busy || !query}
              onClick={() => setQuery("")}
            >
              Clear
            </button>
          </div>
        </div>
        <div>
          <strong>{labels.frequent}</strong>
          <ul className={styles.suggestions}>
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  id={`proposal-${id}-fec-suggestion-${index}`}
                  type="button"
                  disabled={busy}
                  onClick={() => setQuery(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {error && (
        <p
          id={`proposal-${id}-fec-error`}
          role="alert"
          className={styles.error}
        >
          {error}
        </p>
      )}
      <div className={styles.results}>
        <section id={`proposal-${id}-fec-table`} className={styles.panel}>
          <h2>{labels.table}</h2>
          {columns.length > 0 && (
            <div className={styles.filters}>
              {columns.map((column) => (
                <label
                  key={column}
                  htmlFor={`proposal-${id}-fec-filter-${column}`}
                >
                  {title(column)}
                  <input
                    id={`proposal-${id}-fec-filter-${column}`}
                    value={filters[column] ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        [column]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              {Object.values(filters).some(Boolean) && (
                <button type="button" onClick={() => setFilters({})}>
                  Clear filters
                </button>
              )}
            </div>
          )}
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {title(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>
                        {row[column] === null
                          ? ""
                          : column.toLowerCase().includes("cost") &&
                              row[column] !== "" &&
                              Number.isFinite(Number(row[column]))
                            ? amount.format(Number(row[column]))
                            : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p>{labels.empty}</p>}
          </div>
        </section>
        <section id={`proposal-${id}-fec-chart-panel`} className={styles.panel}>
          <div className={styles.chartHeader}>
            <h2>{report?.chart.name || labels.chart}</h2>
            <Select
              id={`proposal-${id}-fec-chart-type`}
              label="Chart type"
              options={chartTypes.map((value) => ({
                value,
                label: title(value),
              }))}
              value={kind}
              onChange={setKind}
              disabled={!chartTypes.length}
            />
          </div>
          {columns.length > 0 && (
            <div className={styles.axes}>
              <MultiSelect
                id={`proposal-${id}-fec-x-field`}
                label="X field"
                options={columns.map((value) => ({
                  value,
                  label: title(value),
                }))}
                value={x}
                onChange={setX}
              />
              <MultiSelect
                id={`proposal-${id}-fec-y-field`}
                label="Y field"
                options={columns.map((value) => ({
                  value,
                  label: title(value),
                }))}
                value={y}
                onChange={setY}
              />
            </div>
          )}
          {kind && rows.length && x.length && y.length ? (
            <Chart
              id={`proposal-${id}-fec-chart`}
              rows={rows}
              x={x}
              y={y}
              kind={kind}
            />
          ) : (
            <p>{labels.empty}</p>
          )}
        </section>
      </div>
    </section>
  );
}
