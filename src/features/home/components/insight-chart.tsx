"use client";
import { useEffect, useRef, useState } from "react";
import type { WidgetData } from "../types";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import { insightOptions } from "@/lib/chart-options";
import { moneyDisplay } from "@/lib/format";
export function InsightChart({
  title,
  data,
  expanded = false,
  showData = false,
  height,
}: {
  title: string;
  data: WidgetData;
  expanded?: boolean;
  showData?: boolean;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false,
      loading = false,
      instance: import("echarts/core").ECharts | undefined;
    async function render() {
      if (disposed || loading || !element!.clientWidth) return;
      if (instance) {
        instance.resize();
        return;
      }
      loading = true;
      try {
        const { renderChart } = await import("./chart-engine");
        if (disposed) return;
        const options = insightOptions(
          data,
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          !!element!.closest(".dark"),
        );
        options.aria = {
          enabled: true,
          label: { description: `${title}: values listed below` },
        };
        instance = renderChart(element!, options);
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        loading = false;
      }
    }
    const resize = new ResizeObserver(() => {
      void render();
    });
    resize.observe(element);
    void render();
    return () => {
      disposed = true;
      resize.disconnect();
      instance?.dispose();
    };
  }, [data, expanded, title, showData]);
  return (
    <div className={`insight-chart${expanded ? " expanded" : ""}`}>
      {!ready && !failed && (
        <div className="chart-loading-overlay">
          <ChartSkeleton label={`Loading ${title} chart`} />
        </div>
      )}
      {failed && (
        <p role="alert">
          The chart renderer could not load. The data table remains available
          below.
        </p>
      )}
      <div
        ref={host}
        className="insight-chart-host"
        style={height ? { height } : undefined}
        role="img"
        aria-label={`${title}: ${data.statistics.length} data points; accessible values below`}
      />
      {data.gauge && (
        <div className="gauge-objectives">
          <strong>
            {moneyDisplay(
              String(data.gauge.value),
              data.presentation?.currency,
            )}
          </strong>
          <p>Organizational Objective</p>
          <span>
            Low:{" "}
            {moneyDisplay(String(data.gauge.low), data.presentation?.currency)}{" "}
            · Medium:{" "}
            {moneyDisplay(
              String(data.gauge.medium),
              data.presentation?.currency,
            )}{" "}
            · Target:{" "}
            {moneyDisplay(
              String(data.gauge.target),
              data.presentation?.currency,
            )}
          </span>
        </div>
      )}
      {(expanded || showData || failed) && (
        <details className="insight-data" open={expanded}>
          <summary>View chart data</summary>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Series</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {data.statistics.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td>{r.series || "—"}</td>
                  <td>
                    {data.presentation?.currency
                      ? moneyDisplay(
                          String(r.value),
                          data.presentation.currency,
                        )
                      : new Intl.NumberFormat("en-GB").format(r.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
