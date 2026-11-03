import "server-only";
import { read, write } from "../client";
import { serverConstants } from "@/server/constants";

/**
 * Funding opportunities: the finder's list and filters, a card's bookmark / notes / share, and the convert's
 * proposal. List bodies come back as read, because the finder, Home and the record each check them their own way.
 */
type Search = {
  orderBy: string;
  sortOrder: string;
  /** The clause and page exactly as the caller's query builder makes them. */
  query: Record<string, string>;
};
/** One page of getOpportunities: the sort as headers, the clause and page as query (as the original). */
export const search = read<Search>({
  op: "getSharedGetOpportunities",
  ttl: serverConstants.ttl.access,
  headers: (p) => ({ p_order_by: p.orderBy, p_sort_order: p.sortOrder }),
  query: (p) => p.query,
});
/** One opportunity as Oracle has it now (getOpportunities filtered on its id). */
export const byId = (id: number) =>
  search({
    orderBy: "publication_date",
    sortOrder: "DESC",
    query: {
      p_where_clause: `("opportunities_id"='${id}')`,
      p_offset: "0",
      p_limit: "1",
    },
  });
/** The user's research preferences (VBCS app-level userPreference), shared with the profile. */
export const userPreference = read({
  op: "getSharedUserPreference",
  ttl: serverConstants.ttl.config,
});
/** Whether anything is new on Featured / Others; held briefly, shared with the shell's nav dot. */
export const newFlags = read({
  op: "getSharedGetOpportunitiesNewFlags",
  ttl: serverConstants.ttl.access,
});
/** The finder's status and funding-type options. */
export const filterOptions = read({
  op: "getSharedOpportunitiesFilter",
  ttl: serverConstants.ttl.config,
});
/** Funders by site, for the funder tree and the EOI list's funder choice. */
export const funders = read({
  op: "getSharedGetOppFunders",
  ttl: serverConstants.ttl.session,
});
export const funderTypes = read({
  op: "getSharedGetOppFunderTypes",
  ttl: serverConstants.ttl.session,
});
export const callCodes = read({
  op: "getSharedGetOppCallCodes",
  ttl: serverConstants.ttl.session,
});
/** Analytics' chart data (`TOP_FUNDERS`, `FUNDING_TYPE`). */
export const statistics = read<{ chartType: string }>({
  op: "getSharedGetOppStatistics",
  headers: (p) => ({ chart_type: p.chartType }),
});
/** WRITES: bookmarks the opportunity for the user. */
export const bookmark = write<{ opportunityId: number }>({
  op: "postSharedBookmarkOpp",
  headers: (p) => ({ p_opp_id: p.opportunityId }),
  invalidates: ["getSharedGetOpportunities"],
});
/** WRITES: removes the user's bookmark. */
export const unbookmark = write<{ opportunityId: number }>({
  op: "deleteSharedBookmarkOpp",
  headers: (p) => ({ p_opp_id: p.opportunityId }),
  invalidates: ["getSharedGetOpportunities"],
});
/** WRITES: the user's notes on the opportunity (already sanitised). */
export const saveNotes = write<{ opportunityId: number; notes: string }>({
  op: "postSharedOppAddlDetails",
  body: (p) => ({ opportunity_id: p.opportunityId, notes: p.notes }),
  invalidates: ["getSharedGetOpportunities"],
});
/** WRITES: the share notification; `body` is the payload built by the share rules. */
export const share = write<{ body: unknown }>({
  op: "postNotificationsSendPersonNotifications",
  body: (p) => p.body,
});
/** WRITES: a new outline or full proposal from the convert's payload. */
export const createProposal = write<{ body: unknown }>({
  op: "postProposalProposal",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  // A convert from an EOI moves the application on, so its held details go too.
  invalidates: [
    "getSharedGetOpportunities",
    "getDynamicFormsGetRequestDetails",
  ],
});
