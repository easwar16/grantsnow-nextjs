import { expect, it } from "vitest";
import { insightRows, fundingEfficiency } from "@/server/home/insight-mapping";
import {
  piePercentages,
  insightOptions,
  oracleChartColors,
} from "@/lib/chart-options";
import { homeFilters } from "@/features/home/schemas";
it("keeps counts and allocates rounded pie shares to exactly 100 percent", () => {
  const rows = [1, 1, 1].map((value, i) => ({
    id: String(i),
    label: String(i),
    value,
  }));
  expect(piePercentages(rows)).toEqual([34, 33, 33]);
  expect(rows.map((r) => r.value)).toEqual([1, 1, 1]);
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
  expect(oracleChartColors.slice(0, 2)).toEqual(["#245d63", "#d7790f"]);
  const options = insightOptions(
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
