import type { EChartsOption } from "echarts";
import type {
  BarSeriesOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from "echarts/charts";
import type { StatisticRow, WidgetData } from "@/features/home/types";
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
export function piePercentages(rows: StatisticRow[]) {
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.value), 0);
  if (!total) return rows.map(() => 0);
  const raw = rows.map((r) => (Math.max(0, r.value) / total) * 100),
    values = raw.map(Math.floor),
    order = raw
      .map((v, i) => ({ i, remainder: v - values[i] }))
      .sort((a, b) => b.remainder - a.remainder);
  const remaining = 100 - values.reduce((sum, v) => sum + v, 0);
  for (let i = 0; i < remaining; i++) values[order[i].i]++;
  return values;
}
export function insightOptions(
  data: WidgetData,
  reducedMotion = false,
  dark = false,
): EChartsOption {
  const type = data.presentation?.type || "bar",
    currency = data.presentation?.currency;
  const compact = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      notation: "compact",
      maximumFractionDigits: 0,
      ...(currency ? { style: "currency", currency } : {}),
    })
      .format(value)
      .replace(/[kmb]$/i, (unit) => unit.toUpperCase());
  const base: EChartsOption = {
    color: oracleChartColors,
    animation: !reducedMotion,
    textStyle: {
      fontFamily: "OracleSans, Arial, sans-serif",
      fontSize: 12,
      color: dark ? "#e2e6e7" : "#514f4d",
    },
    tooltip: {
      trigger:
        type === "pie" || type === "funnel" || type === "scatter"
          ? "item"
          : "axis",
      renderMode: "richText",
      confine: true,
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "middle",
      icon: "rect",
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { fontSize: 12, color: dark ? "#e2e6e7" : "#161513" },
    },
    aria: { enabled: true },
    grid: { left: 45, right: 170, top: 16, bottom: 34 },
  };
  if (type === "gauge") {
    const g = data.gauge;
    if (!g) return base;
    return {
      ...base,
      legend: { show: false },
      series: [
        {
          type: "gauge",
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: g.target,
          radius: "100%",
          center: ["50%", "88%"],
          axisLine: {
            lineStyle: {
              width: 18,
              color: [
                [g.low / g.target, "#c94b3e"],
                [g.medium / g.target, "#e4a347"],
                [1, "#75a844"],
              ],
            },
          },
          progress: { show: true, width: 9 },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            offsetCenter: [0, "-35%"],
            formatter: () => `${Math.round((g.value / g.target) * 100)}%`,
            fontSize: 22,
            color: dark ? "#fff" : "#161513",
          },
          data: [{ value: g.value }],
        },
      ],
    };
  }
  if (type === "pie") {
    const percentages = piePercentages(data.statistics);
    return {
      ...base,
      series: [
        {
          type: "pie",
          radius: "72%",
          center: ["35%", "50%"],
          avoidLabelOverlap: true,
          label: {
            show: true,
            position: "inside",
            formatter: "{d}%",
            fontSize: 11,
            color: "#fff",
          },
          labelLine: { show: false },
          emphasis: { focus: "self", scale: false },
          data: data.statistics.map((r, i) => ({
            name: r.label || " ",
            value: percentages[i],
            rawCount: r.value,
          })),
        },
      ],
    };
  }
  if (type === "funnel")
    return {
      ...base,
      legend: { orient: "horizontal", bottom: 0, top: undefined },
      series: [
        {
          type: "funnel",
          left: "10%",
          top: 10,
          bottom: 40,
          width: "80%",
          sort: "none",
          gap: 8,
          label: {
            position: "inside",
            formatter: (params) =>
              `${params.name}: ${compact(Number(params.value))}`,
          },
          data: data.statistics.map((r) => ({ name: r.label, value: r.value })),
        },
      ],
    };
  const groups = [...new Set(data.statistics.map((r) => r.label))],
    names = [...new Set(data.statistics.map((r) => r.series || r.label))];
  const series: (BarSeriesOption | LineSeriesOption | ScatterSeriesOption)[] =
    names.map((name) => {
      const points = groups.map(
        (group) =>
          data.statistics.find(
            (r) => r.label === group && (r.series || r.label) === name,
          )?.value ?? null,
      );
      if (type === "scatter")
        return {
          type: "scatter",
          name,
          symbolSize: 8,
          data: data.statistics
            .filter((r) => (r.series || r.label) === name)
            .map((r) => [r.label, r.value]),
          emphasis: { focus: "series" },
        };
      if (
        type === "line" ||
        type === "area" ||
        (type === "combo" && name === "Awarded Amount")
      )
        return {
          type: "line",
          name,
          data: points,
          showSymbol: true,
          symbolSize: 6,
          connectNulls: false,
          lineStyle: { width: 2 },
          areaStyle: type === "area" ? { opacity: 0.2 } : undefined,
          emphasis: { focus: "series" },
        };
      return {
        type: "bar",
        name,
        data: points,
        barMaxWidth: 90,
        emphasis: { focus: "series" },
      };
    });
  return {
    ...base,
    legend: { ...base.legend, show: type !== "scatter" },
    grid: {
      ...base.grid,
      right: type === "scatter" ? 16 : 170,
      bottom: type === "scatter" ? 42 : 34,
    },
    xAxis: {
      type: "category",
      data: groups,
      axisLine: { lineStyle: { color: "#aaa7a4" } },
      axisTick: { show: false },
      axisLabel: {
        interval: type === "scatter" ? 0 : "auto",
        rotate: type === "scatter" ? 90 : 0,
        formatter:
          type === "scatter"
            ? (v: string) => (v.length > 5 ? `${v.slice(0, 4)}…` : v)
            : undefined,
      },
    },
    yAxis:
      type === "combo"
        ? [
            { type: "value", name: "No. of applications awarded" },
            {
              type: "value",
              name: "Total awarded amount",
              axisLabel: { formatter: compact },
            },
          ]
        : {
            type: "value",
            axisLine: { show: false },
            axisLabel: { formatter: compact },
            splitLine: { lineStyle: { color: dark ? "#4a5659" : "#e3e6eb" } },
          },
    series,
  };
}
