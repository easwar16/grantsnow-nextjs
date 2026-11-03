"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { useRouter } from "next/navigation";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import type { WidgetData } from "../types";
import { type FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
/** One line of the chart's accessible values. */
type DataRow = {
  key: string;
  category: React.ReactNode;
  series: string;
  value: React.ReactNode;
};
// Drill targets are server-built listing paths; anything else is not navigated to.
const internal = (href?: string) =>
  href?.startsWith("/") && !href.startsWith("//") ? href : undefined;
export function InsightChart({
  id,
  title,
  data,
  expanded = false,
  showData = false,
  height,
  format,
}: {
  id: string;
  title: string;
  data: WidgetData;
  expanded?: boolean;
  showData?: boolean;
  height?: number;
  format?: FormatSettings;
}) {
  const host = useRef<HTMLDivElement>(null),
    router = useRouter(),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false,
      loading = false,
      instance: import("echarts/core").ECharts | undefined;
    const options = functions.charts.insightOptions(
      data,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      !!element.closest(".dark"),
      format,
    );
    options.aria = {
      enabled: true,
      label: { description: `${title}: values listed below` },
    };
    const fitLegend = () => {
      const width = functions.charts.legendTextWidth(
        options,
        element.clientWidth,
      );
      if (width)
        instance?.setOption({
          legend: {
            textStyle: { width, overflow: "truncate" },
            tooltip: { show: true },
          },
        });
    };
    async function render() {
      if (disposed || loading || !element!.clientWidth) return;
      if (instance) {
        instance.resize();
        fitLegend();
        return;
      }
      loading = true;
      try {
        const { renderChart } = await import("./chart-engine");
        if (disposed) return;
        instance = renderChart(element!, options);
        fitLegend();
        instance.on("click", (point) => {
          const href = internal(
            functions.charts.pointRow(
              data,
              String(point.name ?? ""),
              String(point.seriesName ?? ""),
            )?.href,
          );
          if (href) router.push(href);
        });
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        loading = false;
      }
    }
    // The engine chunk loads while the tile is still hidden or sizing; render's own import shares it.
    import("./chart-engine").catch(() => {});
    // ECharts only listens for window resizes; the tile and dialog change size on their own.
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
  }, [data, expanded, title, format, router]);
  const currency = data.presentation?.currency;
  const value = (v: number, money = !!currency) =>
    money
      ? functions.format.moneyDisplay(String(v), currency, format)
      : new Intl.NumberFormat("en-GB", {
          maximumFractionDigits: format?.decimals || 2,
        }).format(v);
  const g = data.gauge;
  return (
    <div id={id} className={`insight-chart${expanded ? " expanded" : ""}`}>
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
        id={`${id}-canvas`}
        className="insight-chart-host"
        style={height ? { height } : undefined}
        role="img"
        aria-label={`${title}: ${g ? "gauge" : `${data.statistics.length} data points`}; accessible values below`}
      />
      {(expanded || showData || failed) && (
        <details id={`${id}-data`} className="insight-data" open={expanded}>
          <summary>View chart data</summary>
          <DataTable<DataRow>
            id={`${id}-data-table`}
            columns={[
              { id: "category", header: "Category", cell: (r) => r.category },
              { id: "series", header: "Series", cell: (r) => r.series },
              { id: "value", header: "Value", cell: (r) => r.value },
            ]}
            rows={
              g
                ? (
                    [
                      ["Total Awarded Funding", g.value],
                      ["Low", g.low],
                      ["Medium", g.medium],
                      ["Target", g.target],
                    ] as const
                  ).map(([name, v]) => ({
                    key: name,
                    category: name,
                    series:
                      name === "Total Awarded Funding"
                        ? "—"
                        : "Organizational Objective",
                    value: value(v, true),
                  }))
                : data.statistics.map((r) => {
                    const href = internal(r.href);
                    return {
                      key: r.id,
                      category: href ? (
                        <Link href={href}>{r.label}</Link>
                      ) : (
                        r.label
                      ),
                      series: r.series || "—",
                      value: value(
                        r.value,
                        // The combo's count series is not money (legacy y converter is decimal).
                        data.presentation?.type === "combo"
                          ? r.series === "Awarded Amount"
                          : undefined,
                      ),
                    };
                  })
            }
            rowKey={(r) => r.key}
          />
        </details>
      )}
    </div>
  );
}
