import "server-only";
import { safeUrl } from "@/lib/security";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import {
  requireDrawerAccess,
  requireModule,
} from "@/server/platform/permissions";
import { opportunities, lookups } from "@/server/oracle/api";
import { dashboardRoles } from "@/server/platform/configuration/service";
import {
  label,
  resources,
  resourceVisible,
  type Resources,
} from "@/server/platform/configuration/resources";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import { sanitizeHtml } from "@/server/platform/sanitize";
import { announcementMessages } from "@/server/modules/home/announcements";
import type { OpportunityQuery } from "@/features/modules/opportunities/schemas";
import {
  META_KEYS,
  opportunityDateKeys,
  type MetaKey,
  type OpportunityCardModel,
  type OpportunityPage,
} from "@/features/modules/opportunities/types";
import { splitFunders } from "@/features/modules/opportunities/display";
import type { FunderRow } from "@/features/modules/opportunities/finder/funders";
import type { FinderFilters } from "@/features/modules/opportunities/finder/state";
import { opportunityOracleQuery } from "./query";
import {
  bundleOf,
  cardActions,
  cardLabelTexts,
  opportunityGlobals,
  type Opener,
} from "./gates";
import type { RoleRow } from "@/server/platform/permissions";
import { AppError, publicError } from "@/lib/errors";
const text = z.string().nullish();
const amount = z.union([z.number(), z.string()]).nullish();
const schema = z.object({
  items: z.array(
    z.object({
      opportunities_id: z.number().int().positive(),
      opp_heading: z.string(),
      opportunity_status: z.string(),
      opp_heading_link: text,
      funders: text,
      co_funders: text,
      site: text,
      logo: text,
      funding_type: text,
      total_fund: amount,
      high_award_range: amount,
      low_award_range: amount,
      currency_code: text,
      funder_type: text,
      programme: text,
      call: text,
      type_of_mga: text,
      aln_number: text,
      funding_opportunity_number: text,
      cost_sharing_requirement: text,
      publication_date: text,
      opening_date: text,
      closing_date: text,
      aoi_app_count: z.number().nullish(),
      proposal_count: z.number().nullish(),
      outline_proposal_count: z.number().nullish(),
      summary: text,
      deadline_date: text,
      is_bookmarked: text,
      is_new: z.union([z.number(), z.string()]).nullish(),
      closing_soon: text,
      other_bookmarks: text,
      notes: text,
      shared_by: text,
      shared_datetime: text,
      shared_comment: text,
      create_application_of_interest: text,
      create_outline_application: text,
      create_grant_application: text,
    }),
  ),
  total_count: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]),
});
type Row = z.infer<typeof schema>["items"][number];
const filled = (v: string | number | null | undefined) =>
  v === null || v === undefined || String(v).trim() === ""
    ? undefined
    : String(v);
// Money cells carry the number; the card formats them in the row's currency and highlights them.
const MONEY: Partial<Record<MetaKey, keyof Row>> = {
  "total-fund": "total_fund",
  "fund-ceiling": "high_award_range",
  "award-floor": "low_award_range",
};
const DATE_META: MetaKey[] = ["shared-on"];
const META_COLUMN: Record<MetaKey, keyof Row> = {
  "funding-type": "funding_type",
  "total-fund": "total_fund",
  "fund-ceiling": "high_award_range",
  programme: "programme",
  call: "call",
  "type-of-mga": "type_of_mga",
  "award-floor": "low_award_range",
  "assistance-listing": "aln_number",
  "funding-opportunity-no": "funding_opportunity_number",
  "cost-sharing": "cost_sharing_requirement",
  "funder-type": "funder_type",
  "shared-by": "shared_by",
  "shared-on": "shared_datetime",
};
const SHARED_ONLY: MetaKey[] = ["shared-by", "shared-on"];
/** The meta values the gates allow, non-empty only; `NA` funding type reads as none, as GN-Angular. */
function metaValues(row: Row, show: (key: string) => boolean, tab: string) {
  return Object.fromEntries(
    META_KEYS.flatMap((key) => {
      if (!show(key) || (SHARED_ONLY.includes(key) && tab !== "shared"))
        return [];
      const raw = row[META_COLUMN[key]] as string | number | null | undefined;
      const value =
        key === "funding-type" && raw === "NA" ? undefined : filled(raw);
      return value === undefined ? [] : [[key, value]];
    }),
  ) as Partial<Record<MetaKey, string>>;
}
export function mapOpportunities(
  raw: unknown,
  query: OpportunityQuery,
  show: (key: string) => boolean,
  currency?: string,
  counts: Set<string> | null = new Set(),
  /** The finder shows the sponsor deadline list in the closing cell; Home (9128) the closing date. */
  preferDeadline = true,
): Omit<OpportunityPage, "card"> {
  const b = schema.parse(raw);
  if (b.offset !== query.offset)
    throw new AppError(
      "CONTRACT",
      "Oracle returned a different opportunity page.",
    );
  const counted = (page: string) => counts?.has(page) === true;
  const rows = b.items.map((row) => ({
    id: String(row.opportunities_id),
    title: row.opp_heading,
    status: row.opportunity_status,
    url: safeUrl(row.opp_heading_link),
    logo: safeUrl(row.logo),
    site: row.site || undefined,
    bookmarked: row.is_bookmarked === "Y",
    isNew: Number(row.is_new) > 0 || row.is_new === "Y",
    closingSoon: row.closing_soon === "Y",
    otherBookmarks: row.other_bookmarks || undefined,
    notes: row.notes ? sanitizeHtml(row.notes) : undefined,
    shared:
      row.shared_by || row.shared_comment
        ? {
            by: row.shared_by || undefined,
            at: row.shared_datetime || undefined,
            comment: row.shared_comment?.trim() || undefined,
          }
        : undefined,
    canApply: row.create_application_of_interest === "Y",
    canConvert: row.create_outline_application === "Y",
    canConvertToProposal: row.create_grant_application === "Y",
    closingAt: row.closing_date || undefined,
    // VBCS finder gates: labels.funder / labels.cofunders.
    funders: show("funder") ? splitFunders(row.funders) : undefined,
    coFunders: show("cofunders") ? splitFunders(row.co_funders) : undefined,
    meta: metaValues(row, show, query.tab),
    currency: Object.keys(MONEY).some(show)
      ? row.currency_code || currency
      : undefined,
    published: show("publication-date")
      ? row.publication_date || undefined
      : undefined,
    opening: show("opening-date") ? row.opening_date || undefined : undefined,
    closing: show("closing-date")
      ? (preferDeadline ? filled(row.deadline_date) : undefined) ||
        row.closing_date ||
        undefined
      : undefined,
    applications:
      show("aoi-count") && counted("opportunities-eoi-count")
        ? (row.aoi_app_count ?? undefined)
        : undefined,
    proposals:
      show("proposals-count") && counted("opportunities-proposal-count")
        ? (row.proposal_count ?? undefined)
        : undefined,
    outlines:
      show("outline-proposals-count") &&
      counted("opportunities-outline-proposal-count")
        ? (row.outline_proposal_count ?? undefined)
        : undefined,
    summary:
      show("summary") && row.summary ? sanitizeHtml(row.summary) : undefined,
  }));
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate opportunities.");
  return {
    rows,
    total: b.total_count,
    hasMore: b.hasMore === true || b.hasMore === "true",
    query,
    ...(counts === null &&
    ["aoi-count", "proposals-count", "outline-proposals-count"].some(show)
      ? { countsUnavailable: true }
      : {}),
  };
}
// The labels the original reads, with its literal fallbacks.
const META_LABELS: Record<MetaKey, string> = {
  "funding-type": "Funding Type",
  "total-fund": "Total Fund",
  "fund-ceiling": "Fund Ceiling",
  programme: "Programme",
  call: "Call",
  "type-of-mga": "Type of MGA",
  "award-floor": "Award Floor",
  "assistance-listing": "Assistance Listing",
  "funding-opportunity-no": "Funding Opportunity No",
  "cost-sharing": "Cost Sharing",
  "funder-type": "Funder Type",
  "shared-by": "Shared By",
  "shared-on": "Shared On",
};
// Home's card shows these three, as the original dashboard CardView.
const DASHBOARD_META: MetaKey[] = ["funding-type", "total-fund", "funder-type"];
/** The finder's 13 cells behind their `labels.<key>` rows (seeded: four hidden, shared-by / -on on Shared only). */
export function metaCells(rows: Resources, opener: Opener, tab: string) {
  const keys =
    opener === "finder"
      ? META_KEYS.filter(
          (key) =>
            (!SHARED_ONLY.includes(key) || tab === "shared") &&
            resourceVisible(rows, "opportunities-eoi", "labels", key),
        )
      : // RB-driven cells show only on an explicit 'Y' (owner rule), Home's from the dashboard bundle.
        DASHBOARD_META.filter((key) =>
          resourceVisible(rows, "dashboard", "labels", key),
        );
  return keys.map((key) => ({
    key,
    label: label(rows, bundleOf(opener), "labels", key, META_LABELS[key]),
    kind: (key in MONEY
      ? "money"
      : DATE_META.includes(key)
        ? "date"
        : "text") as "text" | "money" | "date",
  }));
}
/** Card labels and controls come from the opener's bundle (finder: opportunities-eoi, Home: dashboard), as the two VBCS cards. */
export function opportunityCard(
  rows: Resources,
  opener: Opener,
  roles: RoleRow[] | null = null,
  tab = "",
  deadlineDays: number | null = null,
): OpportunityCardModel {
  return {
    labels: cardLabelTexts(rows, opener),
    dates: opportunityDateKeys.filter((key) =>
      resourceVisible(rows, "opportunities-eoi", "labels", key),
    ),
    meta: metaCells(rows, opener, tab),
    actions: cardActions(rows, roles, opener, tab, deadlineDays),
  };
}
const eoi = (rows: Resources, group: string, key: string) =>
  resourceVisible(rows, "opportunities-eoi", group, key);
/** Advanced fields whose gate is hidden never filter: the server drops them whatever the browser sent. */
export function gatedFilters(rows: Resources, f: FinderFilters): FinderFilters {
  const on = (key: string) => eoi(rows, "labels", key);
  const date = (key: string, d: FinderFilters["publication"]) =>
    on(`${key}-filter`)
      ? d
      : { op: "BETWEEN" as const, on: "", from: "", to: "" };
  return {
    ...f,
    funderType: on("listing-funder-type") ? f.funderType : null,
    publication: date("publication-date", f.publication),
    opening: date("opening-date", f.opening),
    closing: date("closing-date", f.closing),
    totalFundFrom: on("total-fund-from") ? f.totalFundFrom : null,
    totalFundTo: on("total-fund-from") ? f.totalFundTo : null,
    call: on("call-code") ? f.call : "",
    aln: on("assistance-listing") ? f.aln : "",
    fon: on("funding-opportunity-no") ? f.fon : "",
    costSharing: on("cost-sharing") ? f.costSharing : "",
  };
}
export async function listOpportunities(
  query: OpportunityQuery,
  signal?: AbortSignal,
  dashboardFeatured = false,
) {
  const { user } = await authenticate();
  // Home's Featured tab is gated on the finder id alone (shell-page.html); the finder page on its drawer entry.
  if (dashboardFeatured) requireModule(user, "opportunities-finder");
  else requireDrawerAccess(user, "opportunities-finder");
  const labelsRead = resources();
  const featured = {
    p_where_clause: `"preference" = 'Y' AND "opportunity_status" != 'CLOSED'`,
    p_offset: String(query.offset),
    p_limit: "25",
  };
  // Only the list waits for the labels (its filters are gated by them); the rest starts with them.
  const [labels, raw, formatting, roles, deadlineDays] = await Promise.all([
    labelsRead,
    labelsRead.then((labels) => {
      const request = opportunityOracleQuery({
        ...query,
        filters: gatedFilters(labels, query.filters),
      });
      return opportunities.search(
        {
          orderBy: request.headers.p_order_by,
          sortOrder: request.headers.p_sort_order,
          query: dashboardFeatured
            ? featured
            : Object.fromEntries(request.params),
        },
        { signal },
      );
    }),
    formattingConfiguration(),
    // Counts degrade on their own: a failed roles read hides them and the page says so.
    dashboardRoles().then(
      (rows) => rows,
      () => null,
    ),
    opportunityGlobals(),
  ]);
  return {
    ...mapOpportunities(
      raw,
      query,
      (key) => resourceVisible(labels, "opportunities-eoi", "labels", key),
      formatting.currency,
      roles &&
        new Set(
          roles.filter((r) => r.read_access === "Y").map((r) => r.page_name),
        ),
      !dashboardFeatured,
    ),
    card: opportunityCard(
      labels,
      dashboardFeatured ? "dashboard" : "finder",
      roles,
      query.tab,
      deadlineDays,
    ),
  };
}
// ── Finder context: labels, gates, filter options, tabs and the banner ──
const FINDER_LABELS = {
  tabFeatured: ["labels", "finder-tab-featured", "Featured"],
  tabOthers: ["labels", "finder-tab-others", "Others"],
  tabBookmarked: ["labels", "finder-tab-bookmarked", "Bookmarked"],
  tabShared: ["labels", "finder-tab-shared", "Shared"],
  filters: ["aria-labels", "filters", "Filters"],
  toggle: ["button-labels", "toggle", "Toggle"],
  clear: ["button-labels", "clear", "Clear Filters"],
  close: ["button-labels", "close", "Close"],
  funders: ["labels", "filter-by-funders", "Filter By Funders"],
  fundersTree: ["aria-labels", "filter-by-funders", "Filter By Funders"],
  status: ["labels", "finder-filter-status", "Status"],
  funderType: ["labels", "listing-funder-type", "Funder Type"],
  fundingType: ["labels", "finder-filter-funding-type", "Funding Type"],
  dateSort: ["labels", "listing-date-sort", "Date Sort"],
  search: ["labels", "search", "Search"],
  searchAria: ["aria-labels", "search", "Search"],
  advanced: ["button-labels", "filter-button", "Advanced filter"],
  matchAll: ["option-key", "match-all", "Match All"],
  matchAny: ["option-key", "match-any", "Match Any"],
  noData: ["helper-texts", "no-data", "No data to display."],
  total: ["labels", "total-count", "Total"],
  list: ["aria-labels", "opportunities-list", "Opportunities"],
  announcements: ["header-labels", "announcements", "Announcements"],
  keyword: ["labels", "keyword", "Keyword"],
  advFunders: ["labels", "funders", "Funders"],
  publicationFilter: ["labels", "publication-date-filter", "Publication Date"],
  publication: ["labels", "publication-date", "Publication Date"],
  publicationFrom: ["labels", "publication-date-from", "Publication Date From"],
  publicationTo: ["labels", "publication-date-to", "Publication Date To"],
  openingFilter: ["labels", "opening-date-filter", "Opening Date"],
  opening: ["labels", "opening-date", "Opening Date"],
  openingFrom: ["labels", "opening-date-from", "Opening Date From"],
  openingTo: ["labels", "opening-date-to", "Opening Date To"],
  closingFilter: ["labels", "closing-date-filter", "Closing Date"],
  closing: ["labels", "closing-date", "Closing Date"],
  closingFrom: ["labels", "closing-date-from", "Closing Date From"],
  closingTo: ["labels", "closing-date-to", "Closing Date To"],
  totalFundFrom: ["labels", "total-fund-from", "Total Fund From"],
  to: ["labels", "to", "To"],
  callCode: ["labels", "call-code", "Call Code"],
  aln: ["labels", "assistance-listing", "Assistance Listing"],
  fon: ["labels", "funding-opportunity-no", "Funding Opportunity No"],
  costSharing: ["labels", "cost-sharing", "Cost Sharing"],
  advStatus: ["labels", "finder-status", "Status"],
  filter: ["button-labels", "filter", "Filter"],
  advClear: ["button-labels", "clear", "Clear"],
} as const;
export type FinderLabels = Record<keyof typeof FINDER_LABELS, string>;
const FINDER_GATES = {
  funders: "filter-by-funders",
  status: "finder-filter-status",
  funderType: "listing-funder-type",
  fundingType: "finder-filter-funding-type",
  dateSort: "listing-date-sort",
  keyword: "keyword",
  advFunders: "funders",
  publication: "publication-date-filter",
  opening: "opening-date-filter",
  closing: "closing-date-filter",
  totalFund: "total-fund-from",
  callCode: "call-code",
  aln: "assistance-listing",
  fon: "funding-opportunity-no",
  costSharing: "cost-sharing",
  advStatus: "finder-status",
} as const;
export type FinderGates = Record<keyof typeof FINDER_GATES, boolean>;
export interface FilterOption {
  label: string;
  value: string;
}
/** VBCS fetchUniqueValues: trimmed, de-duplicated case-insensitively by value, first wins. */
export function uniqueOptions(
  rows: { filter_type: string; label?: string | null; value: string }[],
  type: string,
): FilterOption[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => r.filter_type === type && r.value.trim() !== "")
    .map((r) => ({
      label: (r.label ?? r.value).trim(),
      value: r.value.trim(),
    }))
    .filter(
      (o) =>
        !seen.has(o.value.toLowerCase()) &&
        (seen.add(o.value.toLowerCase()), true),
    );
}
const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item) });
/** A read that degrades to `empty` and names what failed, for the page's toast (GN-Angular toast.degrade). */
async function degrade<T>(
  what: string,
  read: () => Promise<T>,
  empty: T,
  failures: string[] | null,
): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (e instanceof AppError && e.code === "EXPIRED") throw e;
    failures?.push(`${what} could not be loaded. ${publicError(e).message}`);
    return empty;
  }
}
/** Featured needs a non-empty research preference; a failed read reads as none (GN-Angular degrade(false)). */
export function hasPreferences(raw: unknown) {
  const item = z
    .object({ items: z.array(z.record(z.string(), z.unknown())) })
    .parse(raw).items[0];
  return ["research_areas", "favourite_funder", "research_keywords"].some(
    (k) =>
      typeof item?.[k] === "string" &&
      (item[k] as string).split(",").some((v) => v.trim() !== ""),
  );
}
/** Whether the user has research preferences (Featured or Others first); the page reads it before the context. */
export const finderPreferences = cache(async () => {
  const { user } = await authenticate();
  requireDrawerAccess(user, "opportunities-finder");
  return degrade(
    "Preferences",
    // Shared with the profile (VBCS app-level userPreferences); a research save drops it.
    async () => hasPreferences(await opportunities.userPreference()),
    false,
    null,
  );
});
/** Everything the finder page needs besides the list: RB labels and gates, filter options, tabs and the banner. */
export async function finderContext() {
  const { session, user } = await authenticate();
  requireDrawerAccess(user, "opportunities-finder");
  const token = session.token,
    failures: string[] = [];
  const rowsRead = resources();
  // The banner waits only for its own gate, not for the filter options.
  const bannerRead = rowsRead.then(
    async (rows): Promise<{ messages: string[]; error?: string }> =>
      eoi(rows, "header-labels", "announcements")
        ? announcementMessages(token, "OPPORTUNITIES")
        : { messages: [] },
  );
  const filterRows = degrade(
    "Filter options",
    async () =>
      list(
        z.object({
          filter_type: z.string(),
          label: z.string().nullish(),
          value: z.string(),
        }),
      ).parse(await opportunities.filterOptions()).items,
    [],
    failures,
  );
  const [
    rows,
    banner,
    filters,
    funders,
    funderTypes,
    callCodes,
    operators,
    prefs,
    flags,
  ] = await Promise.all([
    rowsRead,
    bannerRead,
    filterRows,
    degrade(
      "Funders",
      async () =>
        list(
          z.object({
            value: z.string(),
            site: z.string().nullish(),
            site_name: z.string().nullish(),
          }),
        )
          .parse(await opportunities.funders())
          .items.flatMap((r): FunderRow[] =>
            r.site
              ? [
                  {
                    value: r.value,
                    site: r.site,
                    site_name: r.site_name ?? null,
                  },
                ]
              : [],
          ),
      [] as FunderRow[],
      failures,
    ),
    degrade(
      "Funder types",
      async () =>
        list(z.object({ funder_type: z.string().nullish() }))
          .parse(await opportunities.funderTypes())
          .items.flatMap((t) => (t.funder_type?.trim() ? [t.funder_type] : [])),
      [] as string[],
      failures,
    ),
    degrade(
      "Call codes",
      async () =>
        list(z.object({ call: z.string().nullish() }))
          .parse(await opportunities.callCodes())
          // Dev returns one row with no code; it can be neither shown nor filtered on.
          .items.flatMap((c) => (c.call?.trim() ? [c.call] : [])),
      [] as string[],
      failures,
    ),
    // FILTER_OPERATOR: the popup's date operators; a failure leaves BETWEEN only, silently, as the original.
    degrade(
      "Date operators",
      async () =>
        list(
          z.object({
            lookup_type_code: z.string(),
            lookup_code: z.string(),
            lookup_code_value: z.string().nullish(),
          }),
        )
          .parse(await lookups.codes({ types: "FILTER_OPERATOR" }))
          .items.filter((r) => r.lookup_type_code === "FILTER_OPERATOR")
          .map((r) => ({
            value: r.lookup_code,
            label: r.lookup_code_value || r.lookup_code,
          })),
      [] as FilterOption[],
      null,
    ),
    finderPreferences(),
    // The new-dots are decoration; a failure shows none.
    degrade(
      "New flags",
      async () =>
        z
          .object({
            is_new_preference: z.string().nullish(),
            is_new_others: z.string().nullish(),
          })
          // Held briefly and shared with the shell's nav dot (VBCS loads it once per session).
          .parse(await opportunities.newFlags()),
      {} as {
        is_new_preference?: string | null;
        is_new_others?: string | null;
      },
      null,
    ),
  ]);
  return {
    labels: Object.fromEntries(
      Object.entries(FINDER_LABELS).map(([name, [group, key, fallback]]) => [
        name,
        label(rows, "opportunities-eoi", group, key, fallback),
      ]),
    ) as FinderLabels,
    gates: Object.fromEntries(
      Object.entries(FINDER_GATES).map(([name, key]) => [
        name,
        eoi(rows, "labels", key),
      ]),
    ) as FinderGates,
    options: {
      status: uniqueOptions(filters, "STATUS"),
      fundingType: uniqueOptions(filters, "FUNDING_TYPE"),
      funders,
      funderTypes,
      callCodes,
      operators: operators.filter((o) =>
        ["BETWEEN", "GT", "LT", "NULL", "NOT_NULL"].includes(o.value),
      ),
    },
    hasPreferences: prefs,
    newFlags: {
      featured: flags.is_new_preference === "Y",
      others: flags.is_new_others === "Y",
    },
    announcements: banner,
    failures,
  };
}
export type FinderContext = Awaited<ReturnType<typeof finderContext>>;
