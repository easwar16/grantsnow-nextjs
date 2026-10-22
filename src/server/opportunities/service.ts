import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import {
  requireDrawerAccess,
  requireModule,
} from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { dashboardRoles } from "@/server/configuration/service";
import {
  resources,
  resourceVisible,
  type Resources,
} from "@/server/configuration/resources";
import { formattingConfiguration } from "@/server/configuration/formatting";
import { sanitizeHtml } from "@/server/html/sanitize";
import type { OpportunityQuery } from "@/features/opportunities/schemas";
import {
  opportunityDateKeys,
  type OpportunityCardModel,
  type OpportunityPage,
} from "@/features/opportunities/types";
import { splitFunders } from "@/features/opportunities/display";
import { opportunityOracleQuery } from "./query";
import {
  cardActions,
  cardLabelTexts,
  opportunityGlobals,
  type Opener,
  type RoleRow,
} from "./gates";
import { AppError } from "@/lib/errors";
const text = z.string().nullish();
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
      total_fund: z.union([z.number(), z.string()]).nullish(),
      currency_code: text,
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
function safeUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function mapOpportunities(
  raw: unknown,
  query: OpportunityQuery,
  show: (key: string) => boolean,
  currency?: string,
  counts: Set<string> | null = new Set(),
): Omit<OpportunityPage, "card"> {
  const b = schema.parse(raw);
  if (b.offset !== (query.page - 1) * query.pageSize)
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
    fundingType: show("funding-type")
      ? row.funding_type || undefined
      : undefined,
    totalFund:
      show("total-fund") && row.total_fund != null
        ? String(row.total_fund)
        : undefined,
    currency: show("total-fund") ? row.currency_code || currency : undefined,
    published: show("publication-date")
      ? row.publication_date || undefined
      : undefined,
    opening: show("opening-date") ? row.opening_date || undefined : undefined,
    closing: show("closing-date")
      ? row.deadline_date || row.closing_date || undefined
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
    actions: cardActions(rows, roles, opener, tab, deadlineDays),
  };
}
export async function listOpportunities(
  query: OpportunityQuery,
  signal?: AbortSignal,
  dashboardFeatured = false,
) {
  const { session, user } = await authenticate();
  // Home's Featured tab is gated on the finder id alone (shell-page.html); the finder page on its drawer entry.
  if (dashboardFeatured) requireModule(user, "opportunities-finder");
  else requireDrawerAccess(user, "opportunities-finder");
  const [raw, labels, formatting, roles, deadlineDays] = await Promise.all([
    oracle(
      "getSharedGetOpportunities",
      {
        token: session.token,
        p_order_by: query.sort,
        p_sort_order: query.direction,
      },
      dashboardFeatured
        ? new URLSearchParams({
            p_where_clause: `"preference" = 'Y' AND "opportunity_status" != 'CLOSED'`,
            p_offset: String((query.page - 1) * query.pageSize),
            p_limit: String(query.pageSize),
          })
        : opportunityOracleQuery(query),
      signal,
    ),
    resources(),
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
