import "server-only";
import { read, write } from "../client";

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
export const categories = read<void>({
  op: "getOpportunitiesGetOpportunityCategory",
  tokenHeader: false,
});
export const costModels = read<void>({
  op: "getPre_awards_costingGetCostModel",
});
export const budgetVersions = read<{ proposalId: string }>({
  op: "getPre_awards_costingBudget_version",
  query: (p) => ({ proposal_id: p.proposalId }),
});
export const costSummary = read<{ proposalId: string; versionId?: number }>({
  op: "getPre_awards_costingGetCostSummary",
  query: (p) => ({ pid: p.proposalId, prop_version_id: p.versionId }),
});
export const fundingSections = read<{ costModel: string }>({
  op: "getPre_awards_costingGetFundingHdr",
  headers: (p) => ({ cost_model: p.costModel }),
});
export const projectRoles = read<{ costType: string }>({
  op: "getPre_awardGetProjectRoles",
  headers: (p) => ({ cost_type: p.costType }),
});
export const costItems = read<void>({ op: "getPre_awards_costingGetCostItem" });
export const insertCostingBulk = write<{ rows: unknown[] }>({
  op: "postInsertCostingBulk",
  body: (p) => p.rows,
  invalidates: ["getPre_awards_costingGetCostSummary"],
});
export const insertCostingHeader = write<{ body: unknown }>({
  op: "postPre_awards_costingInsertCostingHeaderN",
  identity: ["legal_id", "org_id"],
  headers: () => ({ auto_save: true, p_del_old_lines: "N" }),
  body: (p) => p.body,
  invalidates: ["getPre_awards_costingGetCostSummary"],
});
export const saveCostingLines = write<{ rows: unknown[] }>({
  op: "postPre_awards_costingSaveCostingDataN",
  identity: ["legal_id", "org_id"],
  body: (p) => ({ costing_line_json: p.rows }),
  invalidates: [
    "getPre_awards_costingGetCostSummary",
    "getPre_awards_costingGetCostingLines",
  ],
});
export const costHeaderDetails = read<{ costHeaderId: string }>({
  op: "getPre_awards_costingGetCostHeaderDetails",
  query: (p) => ({ cid: p.costHeaderId }),
});
export const costingLines = read<{ costHeaderId: string }>({
  op: "getPre_awards_costingGetCostingLines",
  query: (p) => ({ cid: p.costHeaderId }),
});
export const pricingDetails = read<{ proposalId: string }>({
  op: "getPre_awards_costingGetPricingDetails",
  query: (p) => ({ proposal_id: p.proposalId }),
});
export const contactDetails = read<{
  recordType: string;
  personId: string;
  departmentId: string;
}>({
  op: "getProposalContactDtls",
  tokenHeader: "p_token",
  headers: (p) => ({
    p_record_type: p.recordType,
    p_person_id: p.personId,
    p_dept_id: p.departmentId,
  }),
});
export const creditAllocation = read<{ versionId: number }>({
  op: "getCreditAllocation",
  headers: (p) => ({ p_prop_period_version_id: p.versionId }),
});
export const linkedApplications = read<{ kind: string; proposalId: string }>({
  op: "getProposalGetApplicationList",
  headers: (p) => ({ p_obj_type: p.kind, p_obj_ref_id: p.proposalId }),
});
export const finalizablePages = read<{ type: string; id: string }>({
  op: "getSharedFinalizablePages",
  headers: (p) => ({ p_obj_type: p.type, p_obj_id: p.id }),
});
export const lockStatus = read<{ type: string; id: string; pageId: number }>({
  op: "getProposalGetLockStatus",
  headers: (p) => ({
    module_name: p.type,
    prop_id: p.id,
    lock_level: p.pageId,
  }),
});
export const setLock = write<{ body: unknown }>({
  op: "postProposalInsertModuleLock",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  invalidates: ["getProposalGetLockStatus", "getProposalGetLockedModules"],
});
/** VBCS Summary Save: POST /Proposal/proposal with an explicit nested payload. */
export const saveSummary = write<{ body: unknown }>({
  op: "postProposalProposal",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  invalidates: ["getProposalProposal_id", "getPre_awardGetProposalsList"],
});
export const deleteCollaborator = write<{ relationId: number }>({
  op: "deletePre_awardDeleteCollaboratorProp_collab_rltn_id",
  path: (p) => ({ prop_collab_rltn_id: String(p.relationId) }),
  invalidates: ["getProposalProposal_id"],
});
