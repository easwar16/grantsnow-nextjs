import { formattingConfiguration } from "@/server/configuration/formatting";
import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import {
  dashboardConfiguration,
  organizations,
} from "@/server/configuration/service";
import { requireModule, scopeOrganization } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { widgets, type WidgetDefinition } from "./widgets";
import type {
  HomeFilters,
  WidgetData,
  WidgetResult,
} from "@/features/home/types";
import { AppError, publicError } from "@/lib/errors";
const envelope = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  offset: z.number().optional(),
});
function str(row: Record<string, unknown>, key: string) {
  const v = row[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
}
export function mapWidget(
  raw: unknown,
  w: WidgetDefinition,
  filters: HomeFilters,
): WidgetData {
  const parsed = envelope.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "This widget returned an unexpected response.",
    );
  const b = parsed.data;
  if (w.kind === "statistics") {
    return {
      attention: [],
      statistics: b.items.map((r, i) => {
        const value = Number(r.value);
        if (
          !Number.isFinite(value) ||
          r.value == null ||
          (r.label !== null &&
            typeof r.label !== "string" &&
            typeof r.label !== "number")
        )
          throw new AppError("CONTRACT", "Statistics returned invalid values.");
        return {
          id: `${str(r, "label")}:${str(r, "code") || i}`,
          // ORDS returns null labels for uncategorized status groups. Preserve
          // that empty category rather than failing the entire chart.
          label: str(r, "label") || "",
          series: str(r, "code"),
          value,
        };
      }),
      hasMore: b.hasMore === true || b.hasMore === "true",
      offset: filters.offset,
    };
  }
  const keys = {
    proposal: [
      "proposal_id",
      "proposal_number",
      "proposal_title",
      "faculty_name",
    ],
    contract: [
      "contract_id",
      "contract_number",
      "contract_title",
      "org_unit_name",
    ],
    ethics: [
      "setup_flow_id",
      "application_number",
      "setup_description",
      "org_unit_name",
    ],
    award: ["award_id", "award_number", "award_name", "faculty_name"],
    eoi: ["request_id", "request_number", "opp_heading", "org_unit_name"],
  }[w.kind];
  return {
    statistics: [],
    attention: b.items.map((r, i) => {
      const reference = str(r, keys[1]);
      if (!reference)
        throw new AppError(
          "CONTRACT",
          "A queue record is missing its reference.",
        );
      const title =
        str(r, keys[2]) ||
        (w.kind === "award" ? str(r, "proposal_title") : undefined) ||
        reference;
      const date =
        str(r, "deadline_date") ||
        str(r, "appr_deadline_date") ||
        str(r, "last_approval_date") ||
        str(r, "proposal_creation_date") ||
        str(r, "contract_start_date") ||
        str(r, "award_creation_date") ||
        str(r, "eoi_creation_date");
      return {
        id: `${str(r, keys[0]) || reference}:${str(r, "deadline_id") || str(r, "stage_id") || i}`,
        reference,
        title,
        context: str(r, keys[3]),
        createdBy: str(r, "full_name") || str(r, "created_by"),
        sponsor: str(r, "primary_sponsorer"),
        deadlineType: str(r, "deadline_type_descr") || str(r, "deadline_type"),
        deadlineDescription:
          str(r, "deadline_description") || str(r, "description"),
        age: str(r, "deadline_days") || str(r, "pending_approval_days"),
        value: str(r, "total_cost"),
        currency: str(r, "currency_code"),
        date,
        overdue: date
          ? Math.trunc((new Date(date).getTime() - Date.now()) / 86400000) <= 0
          : false,
        stage: str(r, "stage_name"),
        href:
          w.kind === "proposal"
            ? `/proposals?reference=${encodeURIComponent(reference)}`
            : undefined,
      };
    }),
    hasMore: b.hasMore === true || b.hasMore === "true",
    offset: filters.offset,
  };
}
export async function homeAccess() {
  // Home is the authenticated landing/context page in VBCS. DASHBOARD roles
  // describe actions, not a "home" read grant. Each widget separately requires
  // its real module grant, configured visibility and token-bound backend scope.
  return authenticate();
}
export async function enabledWidgets() {
  const { user } = await homeAccess(),
    config = await dashboardConfiguration();
  return widgets.filter(
    (w) =>
      user.modules[w.module] === true &&
      config[w.section][w.id]?.isVisible === true,
  );
}
export async function loadWidget(
  id: string,
  filters: HomeFilters,
  signal?: AbortSignal,
): Promise<WidgetData> {
  const { user, session } = await homeAccess(),
    w = widgets.find((w) => w.id === id);
  if (!w) throw new AppError("BAD_REQUEST", "Unknown dashboard widget.", 400);
  requireModule(user, w.module);
  const config = await dashboardConfiguration();
  if (config[w.section][w.id]?.isVisible !== true)
    throw new AppError("FORBIDDEN", "This widget is disabled.", 403);
  const org = scopeOrganization(
    filters.organization || user.organizationId,
    await organizations(),
  );
  const headers: Record<string, string> = { token: session.token };
  if (org) headers[w.orgHeader] = org;
  if (w.chartType) {
    headers.chart_type = w.chartType;
    for (const key of ["year", "quarter", "month"] as const)
      if (filters[key]) headers[key] = filters[key]!;
  }
  const query = new URLSearchParams({
    offset: String(filters.offset),
    limit: "5",
  });
  const mapped = mapWidget(
    await oracle(w.operation, headers, query, signal),
    w,
    filters,
  );
  const formatting = await formattingConfiguration();
  let deadlineTypes: Record<string, string> = {};
  if (mapped.attention.some((row) => row.deadlineType)) {
    const raw = await oracle(
      "getPre_awardGetLookupTypesCodes",
      { token: session.token },
      new URLSearchParams({
        lookupTypeCode: "DEADLINE_TYPE,CTR_DEADLINE_TYPE",
      }),
    );
    const lookup = z
      .object({
        items: z.array(
          z.object({
            lookup_code: z.string(),
            lookup_code_value: z.string(),
            lookup_type_code: z.string(),
          }),
        ),
      })
      .parse(raw);
    deadlineTypes = Object.fromEntries(
      lookup.items
        .filter(
          (row) =>
            row.lookup_type_code ===
            (w.kind === "contract" ? "CTR_DEADLINE_TYPE" : "DEADLINE_TYPE"),
        )
        .map((row) => [row.lookup_code, row.lookup_code_value]),
    );
  }
  return {
    ...mapped,
    attention: mapped.attention.map((row) => ({
      ...row,
      deadlineType: row.deadlineType
        ? deadlineTypes[row.deadlineType] || row.deadlineType
        : undefined,
      ...(row.value !== undefined
        ? { currency: row.currency || formatting.currency }
        : {}),
    })),
  };
}
export async function widgetResult(
  id: string,
  filters: HomeFilters,
): Promise<WidgetResult> {
  try {
    return { ok: true, data: await loadWidget(id, filters) };
  } catch (e) {
    const error = publicError(e);
    return { ok: false, error: { code: error.code, message: error.message } };
  }
}
