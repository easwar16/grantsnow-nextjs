import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { opportunities } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import type { StatisticRow } from "@/features/modules/home/types";

// DEV's FUNDING_TYPE answers a first row with no label; legacy's pie draws it as an unnamed slice.
const schema = z.object({
  items: z.array(
    z.object({
      label: z.string().nullish(),
      value: z.number().finite().nonnegative(),
    }),
  ),
});
export type AnalyticsChart = "TOP_FUNDERS" | "FUNDING_TYPE";
/** One analytics chart's rows (legacy getSharedGetOppStatistics by `chart_type`), as chart statistics. */
export async function opportunityStatistics(
  type: AnalyticsChart,
): Promise<StatisticRow[]> {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(
    user,
    "opportunities-analytics",
  );
  return schema
    .parse(await opportunities.statistics({ chartType: type }))
    .items.map((r, i) => ({
      id: `${type}-${i}`,
      label: r.label ?? "",
      // Legacy series-id: one fixed series for the bars, the label for the pie's slices.
      series: type === "TOP_FUNDERS" ? "Top - Funders" : (r.label ?? ""),
      value: r.value,
    }));
}
/** The page's RB texts (opportunities-eoi page-titles / labels). */
export async function analyticsTexts() {
  const rows = await resources();
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(
      rows,
      "opportunities-eoi",
      group,
      key,
      fallback,
    );
  return {
    title: t("page-titles", "analytics-dashboard", "Analytics Dashboard"),
    topFunders: t("labels", "analytics-top-funders", "Top Funders"),
    averageAmount: t(
      "labels",
      "analytics-average-funding-amount",
      "Average Funding Amount",
    ),
    byFundingType: t(
      "labels",
      "analytics-opportunities-by-funding-type",
      "Opportunities by Funding Type",
    ),
    fundingType: t("labels", "analytics-funding-type", "FundingType"),
  };
}
