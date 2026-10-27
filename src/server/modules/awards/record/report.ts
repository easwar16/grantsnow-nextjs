import "server-only";
import { z } from "zod";
import { awards } from "@/server/oracle/api";
import { label, resources } from "@/server/platform/configuration/resources";
import { orNull } from "@/server/record/shared";
import type {
  ReportMonth,
  ReportView,
} from "@/features/modules/awards/record/report-model";
import { awardRecordRead } from "../record";

const BUNDLE = "award";
const n = z.coerce.number().finite().catch(0);
const graph = z.object({
  items: z.array(
    z.object({
      year: z.union([z.string(), z.number()]),
      label_txt: z.string(),
      value: n,
    }),
  ),
});
const yearly = z.object({
  items: z.array(
    z.object({
      cost_period: z.union([z.string(), z.number()]),
      budget: n,
      actual: n,
      variance: n,
      forecast: n,
    }),
  ),
});
const monthly = z.array(
  z.object({
    funding_header_description: z.string().nullish(),
    total: n,
    children: z.array(z.record(z.string(), z.unknown())).nullish(),
  }),
);
const projects = z
  .array(
    z.object({
      project_id: z.coerce.number().int().positive(),
      project_number: z.union([z.string(), z.number()]).nullish(),
    }),
  )
  .catch([]);
const MONTH = /^[A-Za-z]{3}-\d{4}$/;

/** Legacy getDynColumns: the first child's month columns, shown "Mon YYYY". */
export function reportMonths(raw: unknown): {
  columns: { key: string; label: string }[];
  rows: ReportMonth[];
} {
  const headers = monthly.parse(raw);
  const first = headers[0]?.children?.[0] ?? {};
  const columns = Object.keys(first)
    .filter((k) => MONTH.test(k))
    .map((key) => ({ key, label: key.replace("-", " ") }));
  const rows = headers.map((h, i) => ({
    id: `funding-${i}`,
    name: h.funding_header_description ?? "",
    total: h.total,
    children: (h.children ?? []).map((c, j) => ({
      id: `funding-${i}-${j}`,
      name: String(c.funding_header_description ?? ""),
      values: Object.fromEntries(
        columns.map(({ key }) => [key, Number(c[key]) || 0]),
      ),
    })),
  }));
  return { columns, rows };
}

/**
 * The Project Report tab (legacy awards-report): the award's first project's budget against actuals. Legacy always
 * reported project 1 (`1 || …`) and printed the literal PRJ_200; here it is the award's own first project.
 */
export async function reportView(id: string): Promise<ReportView> {
  const context = await awardRecordRead(id, "report");
  const project = projects.parse(context.raw["Award Projects"] ?? [])[0];
  const rows = await resources();
  const t = (group: string, key: string, fallback: string) =>
    label(rows, BUNDLE, group, key, fallback);
  const texts = {
    projectNumber: "Project Number",
    totalBudget: t("labels", "total-budget", "Total Budget"),
    ptdTotal: t("labels", "ptd-total", "PTD Total"),
    chart: t(
      "labels",
      "budget-actual-forecast-year",
      "Budget, Actual and Forecast by Year",
    ),
    table: t(
      "labels",
      "budget-actual-forecast-year-table",
      "Budget, Actual and Forecast by Year",
    ),
    costPeriod: t("labels", "cost-period", "Cost Period"),
    budget: t("labels", "budget", "Budget"),
    actual: t("labels", "actual", "Actual"),
    variance: t("labels", "variance", "Variance"),
    forecast: t("labels", "forecast", "Forecast"),
    total: "Total",
    monthly: t("header-labels", "actual_by_month", "Actual by Month"),
    name: "Name",
    noData: t("helper-texts", "no-data", "No data to display."),
  };
  if (!project)
    return {
      project: null,
      years: [],
      months: { columns: [], rows: [] },
      chart: [],
      texts,
    };
  const p = { projectId: project.project_id };
  // Each part degrades on its own, as legacy's chains (an empty page each).
  const [g, y, m] = await Promise.all([
    orNull(awards.reportGraph(p).then((b) => graph.parse(b).items)),
    orNull(awards.reportYearly(p).then((b) => yearly.parse(b).items)),
    orNull(awards.reportMonthly(p).then(reportMonths)),
  ]);
  return {
    project: String(project.project_number ?? project.project_id),
    chart: (g ?? []).map((r) => ({
      id: `${r.year}:${r.label_txt}`,
      label: String(r.year),
      series: r.label_txt,
      value: r.value,
    })),
    years: (y ?? []).map((r) => ({ ...r, cost_period: String(r.cost_period) })),
    months: m ?? { columns: [], rows: [] },
    texts,
  };
}
