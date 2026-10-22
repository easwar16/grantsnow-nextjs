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
  label,
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
const cardFallbacks: OpportunityCardModel["labels"] = {
  "publication-date": "Publication Date",
  "opening-date": "Opening Date",
  "closing-date": "Closing Date",
  "funding-type": "Funding Type",
  "total-fund": "Total Fund",
  "aoi-count": "Number of Applications",
  "proposals-count": "Number of Proposals",
  "outline-proposals-count": "Number of Outline Proposals",
  "not-available": "N/A",
  "check-website": "Check website",
  "more-info": "More Info",
};
/** Card labels come from the opener's bundle (finder: opportunities-eoi, Home: dashboard), as the two VBCS cards. */
export function opportunityCard(
  rows: Resources,
  bundle: "opportunities-eoi" | "dashboard",
): OpportunityCardModel {
  return {
    labels: Object.fromEntries(
      Object.entries(cardFallbacks).map(([key, fallback]) => [
        key,
        key === "more-info"
          ? label(rows, bundle, "button-labels", "more_info", fallback)
          : label(rows, bundle, "labels", key, fallback),
      ]),
    ) as OpportunityCardModel["labels"],
    dates: opportunityDateKeys.filter((key) =>
      resourceVisible(rows, "opportunities-eoi", "labels", key),
    ),
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
  const [raw, labels, formatting, roles] = await Promise.all([
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
      dashboardFeatured ? "dashboard" : "opportunities-eoi",
    ),
  };
}
