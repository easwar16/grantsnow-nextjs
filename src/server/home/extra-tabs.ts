import {
  chartDimensions,
  saveChartPreference,
  safeChartReport,
} from "@/server/api/chart-preferences";
import { oracleSettings } from "@/server/configuration/environment";
import "server-only";
import { z } from "zod";
import { homeAccess } from "./service";
import { pageQuery } from "./paging";
import {
  dashboardConfiguration,
  forgetDashboardConfiguration,
  organizations,
} from "@/server/configuration/service";
import { early } from "@/server/async";
import {
  label,
  resources,
  resourceVisible,
} from "@/server/configuration/resources";
import { scopeOrganization } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { sanitizeHtml } from "@/server/html/sanitize";
import { AppError } from "@/lib/errors";
import { listOpportunities } from "@/server/opportunities/service";
import { finderRequest } from "@/features/opportunities/schemas";
export async function dashboardTabs() {
  const [{ user }, config, labels] = await Promise.all([
    homeAccess(),
    dashboardConfiguration(),
    resources(),
  ]);
  const visible = (key: string) =>
    resourceVisible(labels, "dashboard", "button-labels", key);
  const moduleAccess: Record<string, string> = {
    PROPOSAL: "PROPOSALS",
    AWARD: "AWARDS",
    ETHICS: "ETHICS",
    CONTRACT: "CONTRACTS",
    OPPORTUNITIES: "opportunities-finder",
  };
  const chartOption = (key: string) =>
    resourceVisible(labels, "dashboard", "labels", key);
  const charts = Object.entries(config.dynamicCharts || {})
    .filter(
      ([, c]) =>
        c.isVisible === true &&
        !!c.ModuleName &&
        user.modules[moduleAccess[c.ModuleName] || ""] === true,
    )
    .map(([name, c]) => ({
      id: String(c.infolet_id),
      name,
      module: c.ModuleName!,
      dimensions:
        chartOption("dyn-chart-options") && chartOption("dyn-chart-dimensions"),
      reportLink:
        chartOption("dyn-chart-options") && chartOption("dyn-chart-link"),
    }));
  return {
    opportunities:
      config.opportunity === true &&
      user.modules["opportunities-finder"] === true &&
      visible("opportunities"),
    notifications: config.notifications === true && visible("notifications"),
    charts: visible("dynamic-charts") ? charts : [],
  };
}
const NOTIFICATION_PAGE = 25;
/** The dashboard's empty-state text (helper-texts.no-data). */
const emptyText = (labels: Awaited<ReturnType<typeof resources>>) =>
  label(labels, "dashboard", "helper-texts", "no-data", "No data to display.");
export function notificationPage(raw: unknown, offset: number) {
  // The envelope's hasMore/offset do not track p_offset paging (KB GrantsNow-Dashboard), so they are not trusted.
  const body = z
    .object({
      items: z.array(
        z.object({
          id: z.union([z.string(), z.number()]),
          notific_content: z.string(),
          is_read: z.enum(["Y", "N"]),
          datetime: z.string(),
        }),
      ),
    })
    .parse(raw);
  if (new Set(body.items.map((r) => String(r.id))).size !== body.items.length)
    throw new AppError(
      "CONTRACT",
      "Notifications returned inconsistent paging.",
    );
  return {
    rows: body.items.map((r) => ({
      id: String(r.id),
      html: sanitizeHtml(r.notific_content),
      read: r.is_read === "Y",
      date: /(?:Z|[+-]\d\d:\d\d)$/.test(r.datetime)
        ? r.datetime
        : `${r.datetime}Z`,
    })),
    offset,
    limit: NOTIFICATION_PAGE,
    hasMore: body.items.length >= NOTIFICATION_PAGE,
  };
}
export async function notifications(offset: number, signal?: AbortSignal) {
  const [{ session }, tabs] = await Promise.all([
    homeAccess(),
    dashboardTabs(),
  ]);
  if (!tabs.notifications)
    throw new AppError("FORBIDDEN", "Notifications are not enabled.", 403);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 250000 ||
    offset % NOTIFICATION_PAGE !== 0
  )
    throw new AppError("BAD_REQUEST", "Invalid notification page.", 400);
  const [raw, labels] = await Promise.all([
    oracle(
      "getNotificationsNotifications",
      { token: session.token },
      pageQuery(offset, NOTIFICATION_PAGE),
      signal,
    ),
    resources(),
  ]);
  return { ...notificationPage(raw, offset), empty: emptyText(labels) };
}
export const chartSchema = z.array(
  z.object({
    infolet_id: z.union([z.string(), z.number()]),
    name: z.string(),
    // Legacy getCorrectMappingForChart draws any other code, or none, as a pie.
    chart: z
      .string()
      .nullish()
      .transform((c) =>
        ["PIE", "DONUT", "LINE", "LA", "BAR", "AREA"].includes(
          c?.toUpperCase() ?? "",
        )
          ? c!.toUpperCase()
          : "PIE",
      ),
    ModuleName: z.string(),
    "report-url": z.string().optional(),
    colspan: z.coerce.number().int().min(1).max(12).optional(),
    rowspan: z.coerce.number().int().min(1).max(12).optional(),
    grid_dimension: z.string().optional(),
    dataProvider: z.array(
      z.object({
        series: z.union([z.string(), z.number()]).nullish(),
        group: z.union([z.string(), z.number()]),
        // A missing value is a gap, not a zero.
        value: z.preprocess(
          (v) => (v === null || v === undefined || v === "" ? null : v),
          z.coerce.number().finite().nullable(),
        ),
      }),
    ),
  }),
);
export async function dynamicChart(
  id: string,
  organization: string | undefined,
  signal?: AbortSignal,
) {
  const orgs = early(organizations());
  const [{ session }, tabs] = await Promise.all([
    homeAccess(),
    dashboardTabs(),
  ]);
  const descriptor = tabs.charts.find((c) => c.id === id);
  if (!descriptor)
    throw new AppError(
      "FORBIDDEN",
      "This chart is not enabled for your account.",
      403,
    );
  const org = scopeOrganization(organization, await orgs);
  const [raw, labels] = await Promise.all([
    oracle(
      "getSharedGetDynamicCharts",
      {
        token: session.token,
        report_name: id,
        ...(org ? { p_org_id: org } : {}),
      },
      undefined,
      signal,
    ),
    resources(),
  ]);
  const charts = chartSchema.parse(raw);
  const text = (group: string, key: string, fallback: string) =>
    label(labels, "dashboard", group, key, fallback);
  const texts = {
    options: text("labels", "dyn-chart-options", "Options"),
    dimension: text("labels", "dyn-chart-dimensions", "Dimension"),
    link: text("labels", "dyn-chart-link", "Link"),
    title: text("dialog-titles", "dimension", "Dimension"),
    save: text("button-labels", "save", "Save"),
    empty: emptyText(labels),
  };
  if (
    charts.some(
      (c) => String(c.infolet_id) !== id || c.ModuleName !== descriptor.module,
    )
  )
    throw new AppError("CONTRACT", "Oracle returned a different chart.");
  return charts.map((c) => ({
    id: String(c.infolet_id),
    name: c.name,
    dimensions: descriptor.dimensions,
    reportUrl:
      descriptor.reportLink && c["report-url"]
        ? safeChartReport(c["report-url"], oracleSettings().apps.origin)
        : undefined,
    type: c.chart,
    texts,
    // GN-Angular: a chart without a size spans 4 of 12 columns and one 150px row.
    columns:
      c.colspan ?? Number(c.grid_dimension?.match(/^(\d+)x\d+$/)?.[1] || 4),
    rows: c.rowspan ?? Number(c.grid_dimension?.match(/^\d+x(\d+)$/)?.[1] || 1),
    points: c.dataProvider.map((p) => ({
      series: String(p.series ?? p.group),
      group: String(p.group),
      value: p.value,
    })),
  }));
}
export async function featuredOpportunities(
  page: number,
  signal?: AbortSignal,
) {
  if (!(await dashboardTabs()).opportunities)
    throw new AppError(
      "FORBIDDEN",
      "Featured opportunities are not enabled.",
      403,
    );
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new AppError("BAD_REQUEST", "Invalid opportunity page.", 400);
  const query = finderRequest({ tab: "featured", offset: (page - 1) * 25 });
  const [result, labels] = await Promise.all([
    listOpportunities(query, signal, true),
    resources(),
  ]);
  return { ...result, empty: emptyText(labels) };
}

export async function saveDimensions(raw: unknown, signal?: AbortSignal) {
  const parsed = chartDimensions.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Chart dimensions must be whole numbers from 1 to 12.",
      400,
    );
  const [{ session }, tabs] = await Promise.all([
    homeAccess(),
    dashboardTabs(),
  ]);
  const descriptor = tabs.charts.find(
    (c) => c.id === String(parsed.data.infolet_id),
  );
  if (!descriptor?.dimensions)
    throw new AppError(
      "FORBIDDEN",
      "Chart dimensions are not editable for this report.",
      403,
    );
  try {
    await saveChartPreference(session.token, parsed.data, signal);
  } finally {
    // Even a failed save may have landed; the next read asks Oracle again.
    forgetDashboardConfiguration(session.token);
  }
  return { columns: parsed.data.colspan, rows: parsed.data.rowspan };
}
