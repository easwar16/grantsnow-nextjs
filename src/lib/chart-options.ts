import type { EChartsOption } from "echarts";
import type {
  BarSeriesOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from "echarts/charts";
import type { StatisticRow, WidgetData } from "@/features/home/types";
import { moneyDisplay, type FormatSettings } from "@/lib/format";
// Legacy getCorrectMappingForChart: LA is lineWithArea; anything unknown is a pie.
const dynamicTypes: Record<string, "pie" | "line" | "area" | "bar"> = {
  PIE: "pie",
  DONUT: "pie",
  LINE: "line",
  LA: "area",
  AREA: "area",
  BAR: "bar",
};
/** Pies slice by the row's group; the rest group by it and split series by `series` (legacy item template). */
export function dynamicChartData(chart: {
  type: string;
  columns: number;
  points: { series: string; group: string; value: number | null }[];
}): WidgetData {
  return {
    attention: [],
    // A null point is a gap: it gets no row, so no mark.
    statistics: chart.points.flatMap((p, i) =>
      p.value === null
        ? []
        : [{ id: String(i), label: p.group, series: p.series, value: p.value }],
    ),
    hasMore: false,
    offset: 0,
    presentation: {
      type: dynamicTypes[chart.type] || "pie",
      columns: chart.columns,
    },
  };
}
// Redwood --oj-palette-dvt-rgb-1…12, in series order.
export const oracleChartColors = [
  "#245d63",
  "#d7790f",
  "#31a09c",
  "#4e4137",
  "#699e61",
  "#b47282",
  "#83401e",
  "#9e7fcc",
  "#a88e00",
  "#58316e",
  "#5999b5",
  "#317a45",
];
// Redwood --oj-dvt-danger/warning/success-color: the FEI gauge thresholds.
const thresholds = ["#d63b25", "#cf7c00", "#508223"];
// Redwood pie labels use two significant digits: 13%, 8.0%, 1.0%.
const percent = new Intl.NumberFormat("en-US", {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
});
export const pieLabel = (share = 0) => `${percent.format(share)}%`;
/** Nothing to draw: no gauge, or no value other than null or 0 (a chart of zeros has no marks). */
export function chartIsEmpty(
  data: Pick<WidgetData, "statistics" | "gauge" | "presentation">,
) {
  return data.presentation?.type === "gauge"
    ? !data.gauge
    : !data.statistics.some((r) => r.value !== null && r.value !== 0);
}
/** The row a clicked point stands for: its slice name, or its category and series. */
export function pointRow(
  data: WidgetData,
  name: string,
  seriesName: string,
): StatisticRow | undefined {
  const sliced = ["pie", "funnel"].includes(data.presentation?.type || "");
  return data.statistics.find(
    (r) => r.label === name && (sliced || (r.series || r.label) === seriesName),
  );
}
/**
 * ECharts never truncates legend text, so a long name runs over the plot. A legend with a percentage width gets
 * its text cut to that column (less icon, gap and air); hovering an item shows the full name.
 */
export function legendTextWidth(option: EChartsOption, hostWidth: number) {
  const legend = option.legend as { width?: unknown; show?: boolean };
  if (
    legend?.show === false ||
    typeof legend?.width !== "string" ||
    !legend.width.endsWith("%")
  )
    return undefined;
  return Math.max(
    40,
    Math.floor((hostWidth * parseFloat(legend.width)) / 100 - 24),
  );
}
export function insightOptions(
  data: WidgetData,
  reducedMotion = false,
  dark = false,
  format?: FormatSettings,
): EChartsOption {
  const p = data.presentation,
    type = p?.type || "bar",
    currency = p?.currency;
  const text = dark ? "#e2e6e7" : "rgba(22,21,19,0.7)",
    strong = dark ? "#fff" : "#161513",
    gridline = {
      lineStyle: { color: dark ? "#4a5659" : "rgba(22,21,19,0.12)" },
    };
  const font = {
    fontFamily: '"Oracle Sans", "Open Sans", Arial, sans-serif',
    fontSize: 12,
    color: text,
  };
  // en-US compact gives Redwood's capital suffixes (£2M, 1.2K).
  const count = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }),
    amount = currency
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 0,
          style: "currency",
          currency,
        })
      : count;
  // Tooltips and labels use the legacy value converters: configured currency, else decimal.
  const full = (v: unknown, money = !!currency) =>
    v === null || v === undefined
      ? "—"
      : money
        ? moneyDisplay(String(v), currency, format)
        : new Intl.NumberFormat("en-GB", {
            maximumFractionDigits: format?.decimals || 2,
          }).format(Number(v));
  const drills = data.statistics.some((r) => r.href);
  const cursor = drills ? "pointer" : "default";
  const legend = {
    show: p?.legend !== false,
    type: "scroll" as const,
    orient: "vertical" as const,
    right: 0,
    top: "middle",
    icon: "rect",
    itemWidth: 10,
    itemHeight: 10,
    pageIconSize: 10,
    textStyle: { ...font, color: strong },
  };
  const base: EChartsOption = {
    color: oracleChartColors,
    animation: !reducedMotion,
    animationDuration: 400,
    textStyle: font,
    tooltip: {
      trigger: ["pie", "funnel", "scatter", "gauge"].includes(type)
        ? "item"
        : "axis",
      // Plain text: labels come from the backend and are never parsed as HTML.
      renderMode: "richText",
      confine: true,
      valueFormatter: (v) => full(v),
    },
    aria: { enabled: true },
  };
  if (type === "gauge") {
    const g = data.gauge;
    if (!g) return base;
    const stop = (v: number) => Math.min(1, Math.max(0, v / g.target));
    return {
      ...base,
      // The legacy status-meter tooltip: awarded funding against the organisational objective.
      tooltip: {
        ...base.tooltip,
        formatter: () =>
          [
            `Total Awarded Funding: ${full(g.value, true)}`,
            "Organizational Objective",
            `Low: ${full(g.low, true)}`,
            `Medium: ${full(g.medium, true)}`,
            `Target: ${full(g.target, true)}`,
          ].join("\n"),
      },
      series: [
        {
          type: "gauge",
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: g.target,
          radius: "160%",
          center: ["50%", "90%"],
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [stop(g.low), thresholds[0]],
                [stop(g.medium), thresholds[1]],
                [1, thresholds[2]],
              ],
            },
          },
          progress: { show: true, width: 22, itemStyle: { color: "#245d63" } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            offsetCenter: [0, "-20%"],
            fontSize: 18,
            fontWeight: 700,
            color: strong,
            formatter: () => `${Math.round((g.value / g.target) * 100)}%`,
          },
          data: [{ value: g.value, name: "Funding Efficiency Index" }],
        },
      ],
    };
  }
  if (type === "pie" || type === "funnel") {
    const slices = data.statistics.map((r) => ({
      name: r.label,
      value: r.value,
    }));
    return {
      ...base,
      legend: { ...legend, width: "35%" },
      series: [
        type === "pie"
          ? {
              type: "pie",
              radius: "72%",
              center: ["32%", "50%"],
              cursor,
              data: slices,
              label: {
                ...font,
                color: strong,
                formatter: (s) => pieLabel(s.percent),
              },
              labelLine: { length: 8, length2: 8 },
              // Count and share, as the legacy short-desc (label: count) with the slice percentage.
              tooltip: {
                formatter: (s) =>
                  `${s.name}: ${full(s.value, false)} (${pieLabel(s.percent)})`,
              },
            }
          : {
              type: "funnel",
              left: "5%",
              width: "55%",
              gap: 4,
              sort: "none",
              cursor,
              data: slices,
              // Legacy funnel labels each stage with its amount.
              label: {
                ...font,
                color: "#fff",
                position: "inside",
                formatter: (s) => full(s.value),
              },
            },
      ],
    };
  }
  // Cartesian: scatter, bar, line, area and the combo.
  const scatter = type === "scatter",
    combo = type === "combo";
  const groups = [...new Set(data.statistics.map((r) => r.label))],
    names = [...new Set(data.statistics.map((r) => r.series || r.label))];
  const series: (BarSeriesOption | LineSeriesOption | ScatterSeriesOption)[] =
    names.map((name, si) => {
      // One value per group; a missing point stays a gap, never a zero.
      const values = groups.map(
        (group) =>
          data.statistics.find(
            (r) => r.label === group && (r.series || r.label) === name,
          )?.value ?? null,
      );
      if (scatter)
        return { type: "scatter", name, data: values, symbolSize: 8, cursor };
      if (type === "line" || type === "area")
        return {
          type: "line",
          name,
          cursor,
          connectNulls: false,
          lineStyle: { width: 3 },
          itemStyle: {
            color: oracleChartColors[si % oracleChartColors.length],
          },
          areaStyle: type === "area" ? { opacity: 0.2 } : undefined,
          // A marker only on a point with no neighbour, which a line alone would leave invisible.
          data: values.map((v, i) => ({
            value: v,
            symbol:
              v !== null && values[i - 1] == null && values[i + 1] == null
                ? "circle"
                : "none",
            symbolSize: 7,
          })),
        };
      // The combo's amount series sits on the second axis (legacy assigned-to-y2).
      const y2 = combo && name === "Awarded Amount";
      return {
        type: "bar",
        name,
        cursor,
        data: values,
        barMaxWidth: 96,
        stack: p?.stack ? "total" : undefined,
        yAxisIndex: y2 ? 1 : 0,
        tooltip: { valueFormatter: (v) => full(v, combo ? y2 : !!currency) },
      };
    });
  const valueAxis = (name?: string, money = !!currency) => ({
    type: "value" as const,
    name,
    nameLocation: "middle" as const,
    nameGap: 44,
    nameTextStyle: font,
    axisLabel: {
      ...font,
      formatter: (v: number) => (money ? amount : count).format(v),
    },
    splitLine: gridline,
  });
  return {
    ...base,
    legend: scatter ? { show: false } : { ...legend, width: "30%" },
    grid: {
      left: p?.yTitle ? 56 : 44,
      right: scatter || p?.legend === false ? (combo ? 56 : 16) : "32%",
      top: 10,
      bottom: p?.xTitle || scatter ? 44 : 24,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: groups,
      name: p?.xTitle,
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: font,
      axisLabel: {
        ...font,
        rotate: scatter ? 90 : 0,
        width: scatter ? 30 : undefined,
        overflow: "truncate",
      },
      axisLine: gridline,
      axisTick: { show: false },
    },
    yAxis: combo
      ? [
          valueAxis(p?.yTitle, false),
          { ...valueAxis(p?.y2Title), splitLine: { show: false } },
        ]
      : valueAxis(p?.yTitle),
    series,
  };
}
