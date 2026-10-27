import { insightRows, fundingEfficiency } from "./insight-mapping";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import "server-only";
import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE } from "@/lib/format";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import {
  dashboardConfiguration,
  organizations,
} from "@/server/platform/configuration/service";
import {
  requireModule,
  scopeOrganization,
} from "@/server/platform/permissions";
import { home, lookups } from "@/server/oracle/api";
import type { WidgetParams } from "@/server/oracle/api/home";
import { widgets, type WidgetDefinition } from "./widgets";
import { pagedRows, QUEUE_CAP, QUEUE_PAGE } from "./paging";
import type {
  HomeFilters,
  WidgetData,
  WidgetResult,
} from "@/features/modules/home/types";
import { calendarDaysUntil } from "@/features/modules/home/deadline";
import { recordIdentity } from "@/features/modules/proposals/record";
import { awardHref } from "@/features/modules/awards/links";
import { AppError, publicError } from "@/lib/errors";
import { early } from "@/server/platform/async";
const CHART_PAGE = 100;
const envelope = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  offset: z.number().optional(),
  limit: z.number().int().positive().optional(),
  // Only a usable count speeds paging up; anything else falls back to reading until a short page.
  total_count: z.number().int().nonnegative().optional().catch(undefined),
});
function str(row: Record<string, unknown>, key: string) {
  const v = row[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
}
const link = (path: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
  return query.size ? `${path}?${query}` : path;
};
/** Legacy objectHyperlinkNumberClickChain targets: built routes where they exist, else the module placeholder with the record params. */
export function rowHref(
  kind: WidgetDefinition["kind"],
  r: Record<string, unknown>,
  reference: string,
) {
  if (kind === "proposal") {
    const identity = recordIdentity.safeParse({
      type: str(r, "proposal_type"),
      id: str(r, "proposal_id"),
    });
    return identity.success
      ? `/proposals/${identity.data.type}/${identity.data.id}`
      : link("/proposals", { reference });
  }
  if (kind === "eoi") {
    const id = str(r, "request_id");
    return id && /^[1-9]\d{0,14}$/.test(id)
      ? `/opportunities/eoi/${id}`
      : "/opportunities/eoi";
  }
  if (kind === "contract") {
    const id = str(r, "contract_id");
    return id && /^[1-9]\d{0,14}$/.test(id) ? `/contracts/${id}` : "/contracts";
  }
  if (kind === "ethics")
    return link("/modules/ethics", {
      access_type: str(r, "access_type"),
      setup_flow_id: str(r, "setup_flow_id"),
    });
  const awardId = str(r, "award_id");
  return awardId ? awardHref(awardId) : "/awards";
}
/** Today on the viewer's calendar (the shell's time-zone cookie); the server's day until the cookie is set. */
export async function viewerToday(now = new Date()) {
  try {
    const zone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
    if (!zone) return now;
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: zone })
      .format(now)
      .split("-")
      .map(Number);
    return new Date(y, m - 1, d);
  } catch {
    // Outside a request (no viewer) or an unknown zone name: the server's day.
    return now;
  }
}
export function mapWidget(
  raw: unknown,
  w: WidgetDefinition,
  filters: HomeFilters,
  today = new Date(),
): WidgetData {
  if (w.renderType === "gauge") {
    const gauge = fundingEfficiency(raw);
    return {
      attention: [],
      statistics: [],
      hasMore: false,
      offset: filters.offset,
      gauge,
    };
  }
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
      statistics: insightRows(b.items, w.mapping),
      hasMore: false,
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
      const due = w.dueBy ? calendarDaysUntil(str(r, w.dueBy), today) : null;
      return {
        id: `${str(r, keys[0]) || reference}:${str(r, "deadline_id") || str(r, "stage_id") || filters.offset + i}`,
        reference,
        title,
        context: str(r, keys[3]),
        createdBy: str(r, "full_name") || str(r, "created_by"),
        sponsor: str(r, "primary_sponsorer"),
        deadlineType: str(r, "deadline_type_descr") || str(r, "deadline_type"),
        deadlineDescription:
          str(r, "deadline_description") || str(r, "description"),
        age:
          w.overdueNote && due !== null && due < 0
            ? `Overdue by ${Math.abs(due)} Days`
            : str(r, "deadline_days") || str(r, "pending_approval_days"),
        value: str(r, "total_cost"),
        currency: str(r, "currency_code"),
        date: w.date ? str(r, w.date) : undefined,
        overdue: due !== null && due <= 0,
        stage: str(r, "stage_name"),
        href: rowHref(w.kind, r, reference),
        ...(w.kind === "ethics" ? { ethics: true } : {}),
      };
    }),
    // hasMore is unreliable on these endpoints: a full page means there may be more.
    hasMore:
      b.items.length >= QUEUE_PAGE && filters.offset + QUEUE_PAGE < QUEUE_CAP,
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
  const [{ user }, config] = await Promise.all([
    homeAccess(),
    dashboardConfiguration(),
  ]);
  return widgets.filter(
    (w) =>
      user.modules[w.module] === true &&
      config[w.section][w.id]?.isVisible === true,
  );
}
/** Every chart page, p_offset-paged until a short page; repeated pages or the bound are errors, never a partial chart. */
async function chartRows(
  read: (offset: number, limit: number) => Promise<unknown>,
) {
  const seen = new Set<string>();
  const items = await pagedRows(
    async (offset) => envelope.parse(await read(offset, CHART_PAGE)),
    CHART_PAGE,
    (page) => {
      const signature = JSON.stringify(page);
      if (page.length && seen.has(signature))
        throw new AppError("CONTRACT", "Oracle repeated a chart page.");
      seen.add(signature);
    },
    10000,
    () =>
      new AppError("CONTRACT", "A complete chart result could not be loaded."),
  );
  return { items };
}
/** Deadline type names (admin lookups), shared by every queue widget of the session. */
const lookupRows = z.object({
  items: z.array(
    z.object({
      lookup_code: z.string(),
      lookup_code_value: z.string(),
      lookup_type_code: z.string(),
    }),
  ),
});
/** The gauge reads its parameters in one call; its headers are the widget's own. */
function gauge(w: WidgetDefinition, p: WidgetParams, signal?: AbortSignal) {
  return home.gauge(
    {
      headers: {
        [w.orgHeader]: p.orgId || undefined,
        chart_type: p.chartType || undefined,
        year: p.year || undefined,
        quarter: p.quarter || undefined,
        month: p.month || undefined,
      },
    },
    { signal },
  );
}
export async function loadWidget(
  id: string,
  filters: HomeFilters,
  signal?: AbortSignal,
): Promise<WidgetData> {
  const { user } = await homeAccess(),
    w = widgets.find((w) => w.id === id);
  if (!w) throw new AppError("BAD_REQUEST", "Unknown dashboard widget.", 400);
  requireModule(user, w.module);
  if (
    w.kind !== "statistics" &&
    (filters.offset % QUEUE_PAGE !== 0 || filters.offset >= QUEUE_CAP)
  )
    throw new AppError("BAD_REQUEST", "Invalid queue page.", 400);
  // Reference reads start together; each check below still passes before the widget's own read.
  const orgs = early(organizations()),
    format = early(formattingConfiguration());
  const config = await dashboardConfiguration();
  if (config[w.section][w.id]?.isVisible !== true)
    throw new AppError("FORBIDDEN", "This widget is disabled.", 403);
  const org = scopeOrganization(
    filters.organization || user.organizationId,
    await orgs,
  );
  const params: WidgetParams = {
    orgHeader: w.orgHeader,
    orgId: org || undefined,
    ...(w.kind === "statistics"
      ? {
          chartType: w.chartType || undefined,
          year: filters.year || undefined,
          quarter: filters.quarter || undefined,
          month: filters.month || undefined,
        }
      : {}),
  };
  const page = (offset: number, limit: number) => {
    if (!home.isWidgetOperation(w.operation))
      throw new AppError("BAD_REQUEST", "Unknown dashboard widget.", 400);
    return home.widget[w.operation]({ ...params, offset, limit }, { signal });
  };
  const raw =
    w.renderType === "gauge"
      ? await gauge(w, params, signal)
      : w.kind === "statistics"
        ? await chartRows(page)
        : await page(filters.offset, QUEUE_PAGE);
  const mapped = mapWidget(raw, w, filters, await viewerToday());
  const formatting = await format;
  if (w.renderType)
    mapped.presentation = {
      type: w.renderType,
      columns:
        Number.isInteger(Number(config[w.section][w.id]?.ColSpan)) &&
        Number(config[w.section][w.id]?.ColSpan) >= 1 &&
        Number(config[w.section][w.id]?.ColSpan) <= 12
          ? Number(config[w.section][w.id]?.ColSpan)
          : w.columns || 6,
      currency: w.currency ? formatting.currency : undefined,
    };
  let deadlineTypes: Record<string, string> = {};
  if (mapped.attention.some((row) => row.deadlineType)) {
    const lookup = lookupRows.parse(
      await lookups.codes({ types: "DEADLINE_TYPE,CTR_DEADLINE_TYPE" }),
    ).items;
    deadlineTypes = Object.fromEntries(
      lookup
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
