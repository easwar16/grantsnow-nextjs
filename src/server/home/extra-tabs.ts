import {
  chartDimensions,
  saveChartPreference,
  safeChartReport,
} from "@/server/api/chart-preferences";
import { oracleSettings } from "@/server/configuration/environment";
import "server-only";
import { z } from "zod";
import { homeAccess } from "./service";
import {
  dashboardConfiguration,
  organizations,
} from "@/server/configuration/service";
import { resources } from "@/server/configuration/resources";
import { scopeOrganization } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { cleanAnnouncement } from "./announcements";
import { AppError } from "@/lib/errors";
import { listOpportunities } from "@/server/opportunities/service";
import { parseOpportunityQuery } from "@/features/opportunities/schemas";
export async function dashboardTabs() {
  const { user } = await homeAccess();
  const [config, labels] = await Promise.all([
    dashboardConfiguration(),
    resources(),
  ]);
  const visible = (key: string) =>
    labels.some(
      (r) =>
        r.module_name.toLowerCase() === "dashboard" &&
        r.label_type === "button-labels" &&
        r.label_name === key &&
        r.is_visible === "Y",
    );
  const moduleAccess: Record<string, string> = {
    PROPOSAL: "PROPOSALS",
    AWARD: "AWARDS",
    ETHICS: "ETHICS",
    CONTRACT: "CONTRACTS",
    OPPORTUNITIES: "opportunities-finder",
  };
  const chartOption = (key: string) =>
    labels.some(
      (r) =>
        r.module_name.toLowerCase() === "dashboard" &&
        r.label_type === "labels" &&
        r.label_name === key &&
        r.is_visible === "Y",
    );
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
export function notificationPage(raw: unknown, offset: number) {
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
      hasMore: z.union([z.boolean(), z.enum(["true", "false"])]),
      offset: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
    })
    .parse(raw);
  if (
    body.offset !== offset ||
    new Set(body.items.map((r) => String(r.id))).size !== body.items.length
  )
    throw new AppError(
      "CONTRACT",
      "Notifications returned inconsistent paging.",
    );
  return {
    rows: body.items.map((r) => ({
      id: String(r.id),
      html: cleanAnnouncement(r.notific_content),
      read: r.is_read === "Y",
      date: /(?:Z|[+-]\d\d:\d\d)$/.test(r.datetime)
        ? r.datetime
        : `${r.datetime}Z`,
    })),
    offset,
    limit: body.limit,
    hasMore: body.hasMore === true || body.hasMore === "true",
  };
}
export async function notifications(offset: number, signal?: AbortSignal) {
  const { session } = await homeAccess();
  if (!(await dashboardTabs()).notifications)
    throw new AppError("FORBIDDEN", "Notifications are not enabled.", 403);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 250000 ||
    offset % 25 !== 0
  )
    throw new AppError("BAD_REQUEST", "Invalid notification page.", 400);
  return notificationPage(
    await oracle(
      "getNotificationsNotifications",
      { token: session.token },
      new URLSearchParams({ offset: String(offset), limit: "25" }),
      signal,
    ),
    offset,
  );
}
export const chartSchema = z.array(
  z.object({
    infolet_id: z.union([z.string(), z.number()]),
    name: z.string(),
    chart: z.enum(["PIE", "DONUT", "LINE", "LA", "BAR", "AREA"]),
    ModuleName: z.string(),
    "report-url": z.string().optional(),
    colspan: z.coerce.number().int().min(1).max(12).optional(),
    rowspan: z.coerce.number().int().min(1).max(12).optional(),
    grid_dimension: z.string().optional(),
    dataProvider: z.array(
      z.object({
        series: z.union([z.string(), z.number()]).nullish(),
        group: z.union([z.string(), z.number()]),
        value: z.coerce.number().finite(),
      }),
    ),
  }),
);
export async function dynamicChart(
  id: string,
  organization: string | undefined,
  signal?: AbortSignal,
) {
  const { session } = await homeAccess();
  const descriptor = (await dashboardTabs()).charts.find((c) => c.id === id);
  if (!descriptor)
    throw new AppError(
      "FORBIDDEN",
      "This chart is not enabled for your account.",
      403,
    );
  const org = scopeOrganization(organization, await organizations());
  const charts = chartSchema.parse(
    await oracle(
      "getSharedGetDynamicCharts",
      {
        token: session.token,
        report_name: id,
        ...(org ? { p_org_id: org } : {}),
      },
      undefined,
      signal,
    ),
  );
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
    columns:
      c.colspan ?? Number(c.grid_dimension?.match(/^(\d+)x\d+$/)?.[1] || 6),
    rows: c.rowspan ?? Number(c.grid_dimension?.match(/^\d+x(\d+)$/)?.[1] || 3),
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
  const query = parseOpportunityQuery(
    new URLSearchParams({ tab: "featured", page: String(page) }),
  );
  return listOpportunities(query, signal, true);
}

export async function saveDimensions(raw: unknown, signal?: AbortSignal) {
  const parsed = chartDimensions.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Chart dimensions must be whole numbers from 1 to 12.",
      400,
    );
  const { session } = await homeAccess();
  const descriptor = (await dashboardTabs()).charts.find(
    (c) => c.id === String(parsed.data.infolet_id),
  );
  if (!descriptor?.dimensions)
    throw new AppError(
      "FORBIDDEN",
      "Chart dimensions are not editable for this report.",
      403,
    );
  await saveChartPreference(session.token, parsed.data, signal);
  return { columns: parsed.data.colspan, rows: parsed.data.rowspan };
}
