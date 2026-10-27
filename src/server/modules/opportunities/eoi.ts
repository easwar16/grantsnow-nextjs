import "server-only";
import { safeUrl } from "@/lib/security";
import { containsClause } from "@/server/oracle/where";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { requireDrawerAccess } from "@/server/platform/permissions";
import { eoi, lookups, opportunities } from "@/server/oracle/api";
import {
  label,
  resources,
  resourceVisible,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import {
  nameChoices,
  objectDateChoices,
  statusChoices,
} from "@/server/platform/configuration/choices";
import { splitFunders } from "@/features/modules/opportunities/display";
import {
  EOI_PAGE_SIZE,
  type EoiFilters,
} from "@/features/modules/opportunities/eoi-list/schema";
import { EOI_STATUS_TONE } from "@/shared/opportunities/eoi-record";
import {
  type EoiListGates,
  type EoiListPage,
  type EoiListRow,
  type EoiListTextKey,
  type EoiListView,
} from "@/features/modules/opportunities/eoi-list/types";

const BUNDLE = "opportunities-eoi";
const DRAWER = "opportunities-eoi-list";

/** Every gate the page and the row read, as GN-Angular's `visible(key)` (missing row or flag hides). */
export function eoiListGates(rows: Resources): EoiListGates {
  const v = (group: string, key: string) =>
    resourceVisible(rows, BUNDLE, group, key);
  return {
    statusList: v("aria-labels", "eoi-list-choose-navigation-item"),
    number: v("labels", "eoi-list-opportunity-name"),
    title: v("labels", "eoi-list-opportunity-title"),
    funder: v("labels", "eoi-list-sponsor"),
    department: v("labels", "eoi-list-department"),
    createdBy: v("labels", "eoi-list-created-by"),
    dateSort: v("labels", "eoi-list-date-sort"),
    createdAfter: v("labels", "eoi-list-created-after"),
    createdBefore: v("labels", "eoi-list-created-before"),
    clear: v("button-labels", "eoi-list-clear"),
    status: v("labels", "eoi-status"),
    createdOn: v("labels", "eoi-list-created-on"),
    updatedOn: v("labels", "eoi-list-updated-on"),
    view: v("button-labels", "eoi-list-view"),
  };
}

const TEXTS: Record<EoiListTextKey, [string, string, string]> = {
  pageTitle: ["page-titles", "eoi-list", "EOI Application"],
  empty: ["helper-texts", "eoi-list-no-data", "No data to display."],
  statusList: [
    "aria-labels",
    "eoi-list-choose-navigation-item",
    "Choose a navigation item",
  ],
  status: ["labels", "eoi-status", "EOI Status"],
  number: ["labels", "eoi-list-opportunity-name", "Opportunity Number"],
  title: ["labels", "eoi-list-opportunity-title", "Opportunity Title"],
  funder: ["labels", "eoi-list-sponsor", "Funder"],
  department: ["labels", "eoi-list-department", "Department"],
  createdBy: ["labels", "eoi-list-created-by", "Created by"],
  dateSort: ["labels", "eoi-list-date-sort", "Date Sort Option"],
  createdAfter: ["labels", "eoi-list-created-after", "Created After"],
  createdBefore: ["labels", "eoi-list-created-before", "Created Before"],
  clear: ["button-labels", "eoi-list-clear", "Clear"],
  createdOn: ["labels", "eoi-list-created-on", "Created on"],
  updatedOn: ["labels", "eoi-list-updated-on", "Updated On"],
  view: ["button-labels", "eoi-list-view", "View"],
  total: ["labels", "total-count", "Total"],
};

export function eoiListTexts(rows: Resources) {
  return Object.fromEntries(
    Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
      k,
      label(rows, BUNDLE, group, key, fallback),
    ]),
  ) as Record<EoiListTextKey, string>;
}

/** A filter whose gate is hidden cannot be applied, even by a hand-made request (fail closed). */
export function gatedFilters(f: EoiFilters, g: EoiListGates): EoiFilters {
  return {
    ...f,
    status: g.statusList ? f.status : "",
    number: g.number ? f.number : "",
    title: g.title ? f.title : "",
    funder: g.funder ? f.funder : "",
    department: g.department ? f.department : "",
    createdBy: g.createdBy ? f.createdBy : "",
    createdAfter: g.createdAfter ? f.createdAfter : "",
    createdBefore: g.createdBefore ? f.createdBefore : "",
    sortBy: g.dateSort ? f.sortBy : "",
  };
}

const esc = (v: string) => v.replace(/'/g, "''");
// Column names are fixed literals here; only values come from the browser, and every value is quote-doubled.
const contains = (column: string, value: string) =>
  value.trim() ? containsClause(`"${column}"`, value.trim()) : null;

/** VBCS fetchFilterCriteria, in its order (GN-Angular eoiCriteria + whereClause); null when nothing applies. */
export function eoiWhereClause(f: EoiFilters): string | null {
  const parts = [
    contains("opp_heading", f.title),
    contains("funders", f.funder),
    f.createdAfter ? `"creation_date">='${f.createdAfter} 00:00:00'` : null,
    f.createdBefore ? `"creation_date"<='${f.createdBefore} 23:59:59'` : null,
    contains("request_number", f.number),
    contains("org_unit_name", f.department),
    contains("full_name", f.createdBy),
    f.status ? `"status_lkp_code"='${esc(f.status)}'` : null,
  ].filter((p): p is string => p !== null);
  return parts.length ? `(${parts.join(" AND ")})` : null;
}

/** allRequests takes the sort as query params, quoted, and only when a Date Sort column is chosen. */
export function eoiOracleQuery(f: EoiFilters) {
  const where = eoiWhereClause(f);
  return new URLSearchParams({
    p_offset: String(f.offset),
    p_limit: String(EOI_PAGE_SIZE),
    ...(where ? { p_where_clause: where } : {}),
    ...(f.sortBy
      ? {
          p_order_by: `"${f.sortBy}"`,
          p_sort_order: f.dir === "ascending" ? "ASC" : "DESC",
        }
      : {}),
  });
}

const text = z.string().nullish();
const rowSchema = z.object({
  request_id: z.coerce.number().int().positive(),
  request_number: text,
  status: text,
  status_lkp_code: text,
  opp_heading: text,
  full_name: text,
  org_unit_name: text,
  funders: text,
  creation_date: text,
  last_update_date: text,
  logo: text,
});
const listSchema = z.object({
  items: z.array(rowSchema),
  totalcount: z.coerce.number().int().nonnegative().optional(),
  total_count: z.coerce.number().int().nonnegative().optional(),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

const present = (show: boolean, v: string | null | undefined) =>
  show && v ? v : undefined;

/** The allowlisted display model: gated fields only, nothing else from the Oracle row. */
export function mapEoiRow(
  r: z.infer<typeof rowSchema>,
  g: EoiListGates,
): EoiListRow {
  const code = r.status_lkp_code ?? "";
  const status = present(g.status && code !== "", r.status || code);
  return {
    id: String(r.request_id),
    number: present(g.number, r.request_number),
    status,
    tone: status ? EOI_STATUS_TONE[code] : undefined,
    title: present(g.title, r.opp_heading),
    funders: g.funder ? splitFunders(r.funders) : [],
    createdBy: present(g.createdBy, r.full_name),
    department: present(g.department, r.org_unit_name),
    created: present(g.createdOn, r.creation_date),
    updated: present(g.updatedOn, r.last_update_date),
    logo: safeUrl(r.logo),
  };
}

export function mapEoiPage(raw: unknown, g: EoiListGates): EoiListPage {
  const b = listSchema.parse(raw);
  const rows = b.items.map((r) => mapEoiRow(r, g));
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate applications.");
  return {
    rows,
    total: b.totalcount ?? b.total_count ?? null,
    // The original pages on while a page comes back full; ORDS' own flag wins when present.
    hasMore:
      b.hasMore === undefined
        ? b.items.length >= EOI_PAGE_SIZE
        : b.hasMore === true || b.hasMore === "true",
  };
}

const sortChoices = cache(async () =>
  objectDateChoices(
    await lookups.objectDates({ objectType: "OPPORTUNITIES-EOI" }),
  ),
);

/** Gates, texts and drawer choices; a failed choice list degrades to empty, as the original's. */
export async function eoiListView(): Promise<EoiListView> {
  const { user } = await authenticate();
  requireDrawerAccess(user, DRAWER);
  const rows = await resources();
  const gates = eoiListGates(rows);
  const [statuses, funders, sorts] = await Promise.allSettled([
    gates.statusList
      ? lookups
          .codes({ types: "EOI_STATUS" })
          .then((raw) => statusChoices(raw, "EOI_STATUS"))
      : [],
    gates.funder
      ? opportunities.funders().then((raw) => nameChoices(raw, "value"))
      : [],
    gates.dateSort ? sortChoices() : [],
  ]);
  const errors: string[] = [];
  if (statuses.status === "rejected")
    errors.push("Application statuses could not be loaded.");
  if (funders.status === "rejected")
    errors.push("Funders could not be loaded.");
  const value = <T>(r: PromiseSettledResult<T[]>) =>
    r.status === "fulfilled" ? r.value : [];
  return {
    gates,
    texts: eoiListTexts(rows),
    statuses: value(statuses),
    funders: value(funders),
    // fetchDateTypes leaves the select empty on a failure, without a message.
    sorts: value(sorts),
    errors,
  };
}

/** One page of requests; the session, the drawer grant and every filter gate are checked here. */
export async function listEois(
  filters: EoiFilters,
  signal?: AbortSignal,
): Promise<EoiListPage> {
  const { user } = await authenticate();
  requireDrawerAccess(user, DRAWER);
  const gates = eoiListGates(await resources());
  const f = gatedFilters(filters, gates);
  if (f.sortBy && !(await sortChoices()).some((c) => c.value === f.sortBy))
    throw new AppError("BAD_REQUEST", "Unknown date sort option.", 400);
  const raw = await eoi.list(
    {
      module: "OPPORTUNITIES-EOI",
      query: Object.fromEntries(eoiOracleQuery(f)),
    },
    { signal },
  );
  return mapEoiPage(raw, gates);
}
