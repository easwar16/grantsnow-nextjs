import "server-only";
import { z } from "zod";
import { homeAccess } from "./service";
import {
  dashboardConfiguration,
  organizations,
} from "@/server/configuration/service";
import { scopeOrganization } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { publicError } from "@/lib/errors";
const schema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    metric: z.union([z.number(), z.string()]).nullish(),
    meta: z.string().optional(),
    trendColor: z.enum(["success", "danger", "warning", "neutral"]).optional(),
    periodChangeIndicator: z
      .object({ value: z.number(), comparisonPeriod: z.string() })
      .optional(),
    trendChart: z
      .object({ data: z.array(z.object({ value: z.number().nullable() })) })
      .optional(),
  }),
);
export type Kpi = z.infer<typeof schema>[number];
export async function loadKpis(organization?: string) {
  const { session } = await homeAccess();
  const config = await dashboardConfiguration();
  const enabled = Object.entries(config.KPI_STATISTICS || {})
    .filter(([, v]) => v.isVisible === true)
    .map(([key]) => key);
  if (!enabled.length) return { items: [] as Kpi[] };
  const org = scopeOrganization(organization, await organizations());
  try {
    const raw = await oracle("getSharedGetKpiStatistics", {
      token: session.token,
      report_name: enabled.join(","),
      ...(org ? { p_org_id: org } : {}),
    });
    const reports = new Set(enabled.map((id) => id.toLowerCase()));
    return {
      items: schema.parse(raw).filter((r) => reports.has(r.id.toLowerCase())),
    };
  } catch (e) {
    return { items: [] as Kpi[], error: publicError(e).message };
  }
}
