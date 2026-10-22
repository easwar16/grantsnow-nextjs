import { insightRows, fundingEfficiency } from "./insight-mapping";
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
import { pageQuery, QUEUE_CAP, QUEUE_PAGE } from "./paging";
import type {
  HomeFilters,
  WidgetData,
  WidgetResult,
} from "@/features/home/types";
import { calendarDaysUntil } from "@/features/home/deadline";
import { recordIdentity } from "@/features/proposals/record";
import { AppError, publicError } from "@/lib/errors";
const CHART_PAGE = 100;
const envelope = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  offset: z.number().optional(),
  limit: z.number().int().positive().optional(),
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
  if (kind === "contract")
    return link("/modules/contracts", {
      contract_id: str(r, "contract_id"),
      mode: "view",
    });
  if (kind === "ethics")
    // ponytail: legacy also checks getDynamicFormsCheckApplApprAccess before opening; enforce it when the Ethics record route is built.
    return link("/modules/ethics", {
      access_type: str(r, "access_type"),
      setup_flow_id: str(r, "setup_flow_id"),
    });
  return link("/modules/awards", {
    award_id: str(r, "award_id"),
    mode: "view",
  });
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
      // ponytail: server-local calendar day; the user's timezone is not known server-side.
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
  const { user } = await homeAccess(),
    config = await dashboardConfiguration();
  return widgets.filter(
    (w) =>
      user.modules[w.module] === true &&
      config[w.section][w.id]?.isVisible === true,
  );
}
/** Every chart page, p_offset-paged until a short page; repeated pages or the bound are errors, never a partial chart. */
async function chartRows(
  w: WidgetDefinition,
  headers: Record<string, string>,
  signal?: AbortSignal,
) {
  const all: Record<string, unknown>[] = [],
    seen = new Set<string>();
  for (let offset = 0; ;) {
    const page = envelope.parse(
      await oracle(w.operation, headers, pageQuery(offset, CHART_PAGE), signal),
    );
    const signature = JSON.stringify(page.items);
    if (page.items.length && seen.has(signature))
      throw new AppError("CONTRACT", "Oracle repeated a chart page.");
    seen.add(signature);
    all.push(...page.items);
    if (page.items.length !== CHART_PAGE) return { items: all };
    if (all.length >= 10000)
      throw new AppError(
        "CONTRACT",
        "A complete chart result could not be loaded.",
      );
    offset += CHART_PAGE;
  }
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
  if (
    w.kind !== "statistics" &&
    (filters.offset % QUEUE_PAGE !== 0 || filters.offset >= QUEUE_CAP)
  )
    throw new AppError("BAD_REQUEST", "Invalid queue page.", 400);
  const config = await dashboardConfiguration();
  if (config[w.section][w.id]?.isVisible !== true)
    throw new AppError("FORBIDDEN", "This widget is disabled.", 403);
  const org = scopeOrganization(
    filters.organization || user.organizationId,
    await organizations(),
  );
  const headers: Record<string, string> = {
    [w.tokenHeader || "token"]: session.token,
  };
  if (org) headers[w.orgHeader] = org;
  if (w.kind === "statistics") {
    if (w.chartType) headers.chart_type = w.chartType;
    for (const key of ["year", "quarter", "month"] as const)
      if (filters[key]) headers[key] = filters[key]!;
  }
  const raw =
    w.renderType === "gauge"
      ? await oracle(w.operation, headers, undefined, signal)
      : w.kind === "statistics"
        ? await chartRows(w, headers, signal)
        : await oracle(
            w.operation,
            headers,
            pageQuery(filters.offset, QUEUE_PAGE),
            signal,
          );
  const mapped = mapWidget(raw, w, filters);
  const formatting = await formattingConfiguration();
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
