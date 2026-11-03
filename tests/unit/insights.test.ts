import { constants } from "@/lib/constants";
import { expect, it } from "vitest";
import {
  insightRows,
  fundingEfficiency,
  drillHref,
  drillRows,
} from "@/server/modules/home/insight-mapping";
import type { WidgetData } from "@/features/modules/home/types";
import { homeFilters } from "@/features/modules/home/schemas";
import { functions } from "@/lib/functions";
it("labels pie shares to two significant digits, as Redwood does", () => {
  expect([13.04, 8, 1, 0].map(functions.charts.pieLabel)).toEqual([
    "13%",
    "8.0%",
    "1.0%",
    "0.0%",
  ]);
});
it("preserves negative funding gaps and the exact source series", () => {
  const rows = insightRows(
    [{ SECTORS: "Health", APPLIED_AMT: 10, AWARDED_AMT: 15 }],
    "gap",
  );
  expect(rows.map((r) => [r.series, r.value])).toEqual([
    ["Total Awarded Amount", 15],
    ["Gap (Applied - Awarded)", -5],
  ]);
});
it("maps scatter references, totals and funnel fields without substituting metrics", () => {
  expect(
    insightRows([{ x: "P_12", Y: 250, RN: 1 }], "scatter")[0],
  ).toMatchObject({ label: "P_12", value: 250 });
  expect(
    insightRows(
      [{ display_order: 1, label_txt: "Awarded", amount: 500 }],
      "funnel",
    )[0],
  ).toMatchObject({ label: "Awarded", value: 500 });
});
it("treats missing funding efficiency as absent and rejects incomplete targets", () => {
  expect(
    fundingEfficiency([{ widget_name: "OTHER", parameters: [] }]),
  ).toBeUndefined();
  expect(() =>
    fundingEfficiency([
      {
        widget_name: "DASHBOARD_FEI",
        widget_value: 1,
        parameters: [{ param: "FEI_TRAGET", param_value: 20 }],
      },
    ]),
  ).toThrow();
});
it("supports verified comma-separated date filters and rejects injected values", () => {
  expect(
    homeFilters(new URLSearchParams("year=2025,2026&quarter=1,4&month=1,10"))
      .year,
  ).toBe("2025,2026");
  expect(() => homeFilters(new URLSearchParams("year=2026,SQL"))).toThrow();
  expect(() => homeFilters(new URLSearchParams("month=0,13"))).toThrow();
});
it("uses the observed VBCS palette and disables chart motion when requested", () => {
  expect(constants.charts.palette.slice(0, 2)).toEqual(["#245d63", "#d7790f"]);
  const options = functions.charts.insightOptions(
    {
      attention: [],
      statistics: [{ id: "1", label: "2026", series: "Draft", value: 12 }],
      hasMore: false,
      offset: 0,
      presentation: { type: "bar", columns: 6 },
    },
    true,
  );
  expect(options.animation).toBe(false);
  expect(options.xAxis).toMatchObject({ data: ["2026"] });
});

const chart = (
  type: NonNullable<WidgetData["presentation"]>["type"],
  statistics: WidgetData["statistics"],
  extra: Partial<NonNullable<WidgetData["presentation"]>> = {},
): WidgetData => ({
  attention: [],
  statistics,
  hasMore: false,
  offset: 0,
  presentation: { type, columns: 6, ...extra },
});
const access = { PROPOSALS: true, ETHICS: true, AWARDS: true };
it("keeps each chart's drill code: slice code, year status_code and one risk group", () => {
  expect(
    insightRows([{ label: "Submitted", code: "SUB", value: 3 }], "slice")[0],
  ).toMatchObject({ label: "Submitted", code: "SUB", value: 3 });
  expect(
    insightRows(
      [{ label: "2025", code: "Submitted", status_code: "SUB", value: 2 }],
      "year-status",
    )[0],
  ).toMatchObject({ label: "2025", series: "Submitted", code: "SUB" });
  expect(
    insightRows([{ label: "High", code: "HIGH", value: 1 }], "risk")[0],
  ).toMatchObject({ label: "statistics", series: "High", code: "HIGH" });
});
it("drills proposal charts into the listing's own query params", () => {
  const ctx = { organization: "202", modules: access };
  expect(
    drillHref(
      "proposalStatus",
      { id: "1", label: "Sub", value: 1, code: "SUB" },
      ctx,
    ),
  ).toBe("/proposals?status=SUB&department=202");
  // Legacy PROPOSAL_YEAR: the year becomes the creation-date range.
  expect(
    drillHref(
      "proposalYear",
      { id: "1", label: "2025", value: 1, code: "SUB" },
      ctx,
    ),
  ).toBe("/proposals?status=SUB&department=202&from=2025-01-01&to=2025-12-31");
  expect(
    drillHref(
      "proposalSchool",
      { id: "1", label: "Science", value: 1, code: "203" },
      ctx,
    ),
  ).toBe("/proposals?department=203");
  expect(
    drillHref(
      "awardedBySchool",
      { id: "1", label: "Faculty of Health", value: 1 },
      { ...ctx, orgIdByName: new Map([["Faculty of Health", "204"]]) },
    ),
  ).toBe("/proposals?status=AWARD&department=204");
});
it("drills ethics by status, not by org (legacy 9128 defect), and fails closed", () => {
  const ctx = { organization: "202", modules: access };
  expect(
    drillHref(
      "ethicsStatus",
      { id: "1", label: "Open", value: 1, code: "OPEN" },
      ctx,
    ),
  ).toBe("/modules/ethics?filterByStatus=OPEN&filterByOrgUnit=202");
  expect(
    drillHref(
      "ethicsRisk",
      { id: "1", label: "High", value: 1, code: "HIGH" },
      ctx,
    ),
  ).toBe("/modules/ethics?filterByRisk=HIGH&filterByOrgUnit=202");
  expect(
    drillHref(
      "awardStatus",
      { id: "1", label: "Live", value: 1, code: "LIVE" },
      ctx,
    ),
  ).toBe("/awards?status=LIVE&org=202");
  // No grant on the target, no code, or a code the listing would reject: no drill.
  expect(
    drillHref(
      "proposalStatus",
      { id: "1", label: "Sub", value: 1, code: "SUB" },
      { ...ctx, modules: { ETHICS: true } },
    ),
  ).toBeUndefined();
  expect(
    drillHref("proposalStatus", { id: "1", label: "Sub", value: 1 }, ctx),
  ).toBeUndefined();
  expect(
    drillHref(
      "proposalStatus",
      { id: "1", label: "x", value: 1, code: "a'b" },
      ctx,
    ),
  ).toBeUndefined();
  const [row] = drillRows(
    [{ id: "1", label: "Sub", value: 1, code: "SUB" }],
    "proposalStatus",
    ctx,
  );
  expect(row).toEqual({
    id: "1",
    label: "Sub",
    value: 1,
    href: "/proposals?status=SUB&department=202",
  });
});
it("draws pies from counts with percentage labels and finds the clicked slice", () => {
  const data = chart("pie", [
    { id: "a", label: "Draft", value: 3, href: "/proposals?status=DRFT" },
    { id: "b", label: "Submitted", value: 1 },
  ]);
  const options = functions.charts.insightOptions(data);
  const [pie] = options.series as { data: unknown[]; cursor: string }[];
  expect(pie.data).toEqual([
    { name: "Draft", value: 3 },
    { name: "Submitted", value: 1 },
  ]);
  expect(pie.cursor).toBe("pointer");
  expect(functions.charts.pointRow(data, "Draft", "")?.href).toBe(
    "/proposals?status=DRFT",
  );
});
it("stacks the gap chart, puts the combo amount on the second axis and keeps gaps", () => {
  const gap = functions.charts.insightOptions(
    chart(
      "bar",
      [
        { id: "1", label: "Health", series: "Awarded", value: 5 },
        { id: "2", label: "Health", series: "Gap", value: 2 },
        { id: "3", label: "Arts", series: "Gap", value: 1 },
      ],
      { stack: true, xTitle: "Grant Category" },
    ),
  );
  const [awarded] = gap.series as { stack?: string; data: unknown[] }[];
  expect(awarded.stack).toBe("total");
  expect(awarded.data).toEqual([5, null]);
  expect(gap.xAxis).toMatchObject({ name: "Grant Category" });
  const combo = functions.charts.insightOptions(
    chart("combo", [
      { id: "1", label: "Health", series: "Awarded Proposals", value: 2 },
      { id: "2", label: "Health", series: "Awarded Amount", value: 900 },
    ]),
  );
  expect(
    (combo.series as { yAxisIndex: number }[]).map((s) => s.yAxisIndex),
  ).toEqual([0, 1]);
});
it("marks only isolated line points and truncates the legend to its column", () => {
  const line = functions.charts.insightOptions(
    chart("line", [
      { id: "1", label: "2024", series: "Total", value: 1 },
      { id: "2", label: "2025", series: "Total", value: 2 },
      { id: "3", label: "2026", series: "Award", value: 3 },
    ]),
  );
  const [total, award] = line.series as { data: { symbol: string }[] }[];
  expect(total.data.map((d) => d.symbol)).toEqual(["none", "none", "none"]);
  expect(award.data.map((d) => d.symbol)).toEqual(["none", "none", "circle"]);
  expect(functions.charts.legendTextWidth(line, 600)).toBe(156);
  expect(
    functions.charts.legendTextWidth(
      functions.charts.insightOptions(chart("scatter", [])),
      600,
    ),
  ).toBeUndefined();
});
it("treats all-zero data and a missing gauge as empty, and clamps gauge bands", () => {
  expect(
    functions.charts.chartIsEmpty(
      chart("pie", [{ id: "1", label: "x", value: 0 }]),
    ),
  ).toBe(true);
  expect(
    functions.charts.chartIsEmpty(
      chart("bar", [{ id: "1", label: "x", value: -1 }]),
    ),
  ).toBe(false);
  expect(functions.charts.chartIsEmpty(chart("gauge", []))).toBe(true);
  const gauge = functions.charts.insightOptions({
    ...chart("gauge", []),
    gauge: { value: 5, low: 20, medium: 30, target: 10 },
  });
  const [series] = gauge.series as {
    axisLine: { lineStyle: { color: [number, string][] } };
  }[];
  expect(series.axisLine.lineStyle.color.map(([stop]) => stop)).toEqual([
    1, 1, 1,
  ]);
});
it("maps dynamic charts as legacy: unknown type is a pie and null points are gaps", () => {
  const data = functions.charts.dynamicChartData({
    type: "RADAR",
    columns: 4,
    points: [
      { group: "Draft", series: "Draft", value: 2 },
      { group: "Sent", series: "Sent", value: null },
    ],
  });
  expect(data.presentation?.type).toBe("pie");
  expect(data.statistics.map((r) => r.label)).toEqual(["Draft"]);
  expect(
    functions.charts.dynamicChartData({ type: "LA", columns: 4, points: [] })
      .presentation?.type,
  ).toBe("area");
});
