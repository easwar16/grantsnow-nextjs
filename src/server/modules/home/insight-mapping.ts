import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { StatisticRow } from "@/features/modules/home/types";
import {
  querySchema,
  serializeQuery,
} from "@/features/modules/proposals/schemas";
import { drawerAccess } from "@/server/platform/permissions";
/** A chart row plus the code a click on it drills by; the code never leaves the server. */
export type InsightRow = StatisticRow & { code?: string };
export function insightRows(
  items: Record<string, unknown>[],
  mapping?: string,
): InsightRow[] {
  const number = (v: unknown) => {
    if (
      v === null ||
      v === undefined ||
      v === "" ||
      !["string", "number"].includes(typeof v) ||
      !Number.isFinite(Number(v))
    )
      throw new AppError(
        "CONTRACT",
        "Insights returned an invalid numeric value.",
      );
    return Number(v);
  };
  const text = (v: unknown) =>
    typeof v === "string" || typeof v === "number" ? String(v) : "";
  const code = (v: unknown) => text(v) || undefined;
  return items.flatMap((r, i): InsightRow[] => {
    // Pies slice by label (legacy series-id = label); the slice's code is what the drill sends.
    if (mapping === "slice")
      return [
        {
          id: `${text(r.label)}:${i}`,
          label: text(r.label),
          value: number(r.value),
          code: code(r.code),
        },
      ];
    // Year groups, status series; the drill uses the row's status_code (legacy 9143).
    if (mapping === "year-status")
      return [
        {
          id: `${text(r.label)}:${text(r.code)}:${i}`,
          label: text(r.label),
          series: text(r.code) || undefined,
          value: number(r.value),
          code: code(r.status_code),
        },
      ];
    // One "statistics" group with a bar per risk level, as the legacy chart draws it.
    if (mapping === "risk")
      return [
        {
          id: `${text(r.label)}:${i}`,
          label: "statistics",
          series: text(r.label),
          value: number(r.value),
          code: code(r.code),
        },
      ];
    if (mapping === "scatter")
      return [
        {
          id: String(r.RN ?? i),
          label: text(r.x),
          series: text(r.x),
          value: number(r.Y),
        },
      ];
    if (mapping === "top-category")
      return [
        {
          id: `${i}:a`,
          label: text(r.SECTORS),
          series: "Awarded Proposals",
          value: number(r.NUM_PROP),
        },
        {
          id: `${i}:b`,
          label: text(r.SECTORS),
          series: "Awarded Amount",
          value: number(r.AMOUNT),
        },
      ];
    if (mapping === "category" || mapping === "gap") {
      const applied = number(r.APPLIED_AMT),
        awarded = number(r.AWARDED_AMT),
        label = text(r.SECTORS);
      return [
        {
          id: `${i}:a`,
          label,
          series:
            mapping === "gap" ? "Total Awarded Amount" : "Total Applied Amount",
          value: mapping === "gap" ? awarded : applied,
        },
        {
          id: `${i}:b`,
          label,
          series:
            mapping === "gap"
              ? "Gap (Applied - Awarded)"
              : "Total Awarded Amount",
          value: mapping === "gap" ? applied - awarded : awarded,
        },
      ];
    }
    if (mapping === "funnel")
      return [
        {
          id: String(r.display_order ?? i),
          label: text(r.label_txt),
          value: number(r.amount),
        },
      ];
    return [
      {
        id: `${text(r.label)}:${text(r.code ?? r.seriesid)}:${i}`,
        label: text(r.label),
        series: text(r.code ?? r.seriesid) || undefined,
        value: number(r.value),
      },
    ];
  });
}
export function fundingEfficiency(raw: unknown) {
  const candidate = z
    .array(z.object({ widget_name: z.string() }).passthrough())
    .parse(raw)
    .find((r) => r.widget_name === "DASHBOARD_FEI");
  if (!candidate) return undefined;
  const row = z
    .object({
      widget_value: z
        .union([z.number(), z.string().min(1)])
        .transform(Number)
        .refine(Number.isFinite),
      parameters: z.array(
        z.object({
          param: z.string(),
          param_value: z.union([z.number(), z.string().min(1)]),
        }),
      ),
    })
    .parse(candidate);
  const params = Object.fromEntries(
    row.parameters.map((p) => [p.param, Number(p.param_value)]),
  );
  if (
    !Number.isFinite(params.FEI_TARGET) ||
    params.FEI_TARGET <= 0 ||
    !Number.isFinite(params.FEI_LOW) ||
    !Number.isFinite(params.FEI_MEDIUM)
  )
    throw new AppError(
      "CONTRACT",
      "Funding efficiency targets are missing or invalid.",
    );
  return {
    value: row.widget_value,
    low: params.FEI_LOW,
    medium: params.FEI_MEDIUM,
    target: params.FEI_TARGET,
  };
}

export type InsightDrill =
  | "proposalStatus"
  | "proposalYear"
  | "proposalSchool"
  | "awardedBySchool"
  | "awardStatus"
  | "ethicsStatus"
  | "ethicsOrg"
  | "ethicsRisk";
export interface DrillContext {
  /** The dashboard organization the chart was drawn for. */
  organization?: string;
  /** Org unit id by name, for the awarded-by-school pie whose slices are org names. */
  orgIdByName?: Map<string, string>;
  modules: Record<string, boolean>;
}
const placeholder = (
  module: string,
  params: Record<string, string | undefined>,
) => {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
  return query.size ? `/modules/${module}?${query}` : undefined;
};
/** The listing filtered through its own query schema; a value the listing would reject drills nowhere. */
function proposals(filters: Record<string, string | undefined>) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  );
  const query = parsed.success ? serializeQuery(parsed.data) : "";
  return query ? `/proposals?${query}` : undefined;
}
/**
 * The listing a chart point opens: legacy pieChartDrillChain and statusPieChartSelectionChangeChain, with their
 * app-scope filters carried as URL params. Ethics and Awards open their placeholders with the legacy nav params.
 */
export function drillHref(
  drill: InsightDrill,
  row: InsightRow,
  ctx: DrillContext,
): string | undefined {
  const target = drill.startsWith("ethics")
    ? "ethics"
    : drill === "awardStatus"
      ? "awards"
      : "proposals";
  if (!drawerAccess(ctx.modules, target)) return undefined;
  const org = ctx.organization;
  if (drill === "awardedBySchool")
    return proposals({
      status: "AWARD",
      department: ctx.orgIdByName?.get(row.label),
    });
  if (drill === "proposalYear") {
    const year = /^\d{4}$/.test(row.label) ? row.label : undefined;
    return proposals({
      status: row.code,
      department: org,
      from: year && `${year}-01-01`,
      to: year && `${year}-12-31`,
    });
  }
  if (!row.code) return undefined;
  if (drill === "proposalStatus")
    return proposals({ status: row.code, department: org });
  // Legacy PROPOSAL_SCHOOL filters pi_dept_code by the slice code; keyForFaculty is ignored by the listing.
  if (drill === "proposalSchool") return proposals({ department: row.code });
  if (drill === "awardStatus")
    return placeholder("awards", { byStatus: row.code });
  // Legacy 9128 wrote the status code into the org filter; the status drill now filters by status.
  if (drill === "ethicsStatus")
    return placeholder("ethics", {
      filterByStatus: row.code,
      filterByOrgUnit: org,
    });
  if (drill === "ethicsOrg")
    return placeholder("ethics", { filterByOrgUnit: row.code });
  return placeholder("ethics", {
    filterByRisk: row.code,
    filterByOrgUnit: org,
  });
}
/** Rows for the browser: each gets its drill target, and the raw code is dropped. */
export function drillRows(
  rows: InsightRow[],
  drill: InsightDrill | undefined,
  ctx: DrillContext,
): StatisticRow[] {
  return rows.map(({ code, ...row }) => {
    const href = drill && drillHref(drill, { ...row, code }, ctx);
    return href ? { ...row, href } : row;
  });
}
