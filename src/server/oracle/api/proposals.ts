import "server-only";
import { read } from "../client";

/**
 * The Proposal listing and summary reads, held only for the request. Its lookups, people and roles come from the shared
 * `lookups` / `people` / `roles` functions. Bodies the service checks with its own contract errors come back as read.
 */
/** One listing page: the server-built where clause, sort and `p_offset` / `p_limit` (proposals/where-clause.ts). */
export const list = read<{ query: URLSearchParams }>({
  op: "getPre_awardGetProposalsList",
  query: (p) => Object.fromEntries(p.query),
});
/** One Proposal's summary record. */
export const summary = read<{ id: string }>({
  op: "getProposalProposal_id",
  path: (p) => ({ proposal_id: p.id }),
});
