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
export const advancedList = read<{ query: URLSearchParams }>({
  op: "getProposalsListAdvanced",
  query: (p) => Object.fromEntries(p.query),
});
export const deleted = read<void>({
  op: "getPre_awardGetDeletedProposalsList",
});
export const copyObjects = read<{ type: string }>({
  op: "getProposalCopyProposalObjList",
  headers: (p) => ({ P_OBJ_TYPE: p.type }),
});
export const copy = write<{ id: number; objects: string[] }>({
  op: "postProposalCopyProposal",
  identity: ["legal_id", "org_id"],
  body: (p) => ({
    proposal_id: p.id,
    convert_proposal: "N",
    objects: p.objects.map((object_name) => ({
      object_name,
      object_val: "true",
    })),
  }),
  invalidates: ["getPre_awardGetProposalsList"],
});
export const remove = write<{ id: string }>({
  op: "deleteProposalProposalProposal_id",
  path: (p) => ({ proposal_id: p.id }),
  invalidates: [
    "getPre_awardGetProposalsList",
    "getPre_awardGetDeletedProposalsList",
  ],
});
export const restore = write<{ id: string }>({
  op: "getProposalRestoreProposalProposal_id",
  path: (p) => ({ proposal_id: p.id }),
  invalidates: [
    "getPre_awardGetProposalsList",
    "getPre_awardGetDeletedProposalsList",
  ],
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
export const projectRoles = read<{ costType: string }>({
  op: "getPre_awardGetProjectRoles",
  headers: (p) => ({ cost_type: p.costType }),
});
export const salaryModels = read<{ costModel: string; costType: string }>({
  op: "getPre_awards_costingGetSalModelList",
  headers: (p) => ({ cost_model_id: p.costModel, cost_type: p.costType }),
});
export const roleFundingSection = read<{ costModel: string; role: string }>({
  op: "getPre_awards_costingGetProjectRoleFundHdr",
  headers: (p) => ({ costmodel_id: p.costModel, project_role_code: p.role }),
});
export const costingPersonDetails = read<{
  proposalId: string;
  personId: number;
  orgUnitId: number;
}>({
  op: "getPre_awards_costingGetPersonMasterViewDetails",
  query: (p) => ({ person_id: p.personId }),
  headers: (p) => ({ prop_id: p.proposalId, org_unit_id: p.orgUnitId }),
});
export const staffTimeReport = read<{
  employeeNumber: string;
  startDate: string;
  endDate: string;
}>({
  op: "getReportsGetStaffTimeReport",
  headers: (p) => ({
    emp_no: p.employeeNumber,
    in_start_date: p.startDate,
    in_end_date: p.endDate,
  }),
});
/** Cost items: every item (quick cost), or one category's (research partner costs). */
export const costItems = read<{ category?: string } | void>({
  op: "getPre_awards_costingGetCostItem",
  query: (p) => (p?.category ? { cost_cat_type: p.category } : {}),
});
export const insertCostingBulk = write<{ rows: unknown[] }>({
  op: "postInsertCostingBulk",
  body: (p) => p.rows,
  invalidates: ["getPre_awards_costingGetCostSummary"],
});
export const insertCostingHeader = write<{
  body: unknown;
  deleteOldLines?: boolean;
}>({
  op: "postPre_awards_costingInsertCostingHeaderN",
  identity: ["legal_id", "org_id"],
  headers: (p) => ({
    auto_save: true,
    p_del_old_lines: p.deleteOldLines ? "Y" : "N",
  }),
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
export const calculateStaffLine = write<{ row: Record<string, unknown> }>({
  op: "postPre_awards_costingGetTotFecCostLineN",
  identity: ["legal_id", "org_id"],
  body: (p) => ({ costing_line_json: [p.row] }),
  invalidates: [
    "getPre_awards_costingGetCostingLines",
    "getPre_awards_costingGetCostSummary",
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
export const defaultPricing = read<{
  proposalId: string;
  sponsorPartyId: number;
}>({
  op: "getPre_awards_costingGetDefaultPricing",
  query: (p) => ({
    proposal_id: p.proposalId,
    p_sponsor_party_id: p.sponsorPartyId,
    update_data: "N",
  }),
});
/** WRITES: pricing lines; with `funderId`, one funder's lines (the funder header). */
export const savePricingLines = write<{ funderId?: number; rows: unknown[] }>({
  op: "postPre_awards_costingInsertPricingLines",
  identity: ["legal_id", "org_id"],
  headers: (p) => (p.funderId === undefined ? {} : { funder_id: p.funderId }),
  body: (p) => p.rows,
  invalidates: ["getPre_awards_costingGetPricingDetails"],
});
export const creditAllocation = read<{ versionId: number }>({
  op: "getCreditAllocation",
  headers: (p) => ({ p_prop_period_version_id: p.versionId }),
});
export const inKindSponsors = read<{ proposalId: string }>({
  op: "getPre_awardPropinkind",
  headers: (p) => ({ proposal_id: p.proposalId }),
});
export const inKindCostItems = read<{ proposalId: string }>({
  op: "getPre_awardInkindCostItems",
  headers: (p) => ({ proposal_id: p.proposalId }),
});
export const researchPartnerHeaders = read<{ proposalId: string }>({
  op: "getPre_awardResearchPartnerHeader",
  query: (p) => ({ proposal_id: p.proposalId }),
});
export const researchPartnerLines = read<{ proposalId: string }>({
  op: "getPre_awardResearchPartnerLine",
  query: (p) => ({ proposal_id: p.proposalId }),
});
export const saveResearchPartnerHeaders = write<{ rows: unknown[] }>({
  op: "postPre_awardResearchPartnerHeader",
  body: (p) => ({ researchPartnerHeader: p.rows }),
  invalidates: ["getPre_awardResearchPartnerHeader"],
});
export const saveResearchPartnerLines = write<{ rows: unknown[] }>({
  op: "postPre_awardResearchPartnerLine",
  body: (p) => ({ researchPartnerLine: p.rows }),
  invalidates: [
    "getPre_awardResearchPartnerLine",
    "getPre_awardResearchPartnerHeader",
  ],
});
export const deleteResearchPartnerLine = write<{ lineId: number }>({
  op: "deletePre_awardResearchPartnerLine",
  query: (p) => ({ id: p.lineId }),
  invalidates: [
    "getPre_awardResearchPartnerLine",
    "getPre_awardResearchPartnerHeader",
  ],
});
export const inKindLines = read<{ proposalId: string }>({
  op: "getPre_awardPropinkindcostline",
  headers: (p) => ({ proposal_id: p.proposalId }),
});
export const saveInKindSponsors = write<{
  proposalId: string;
  rows: unknown[];
}>({
  op: "postPre_awardPropinkind",
  headers: (p) => ({ proposal_id: p.proposalId }),
  body: (p) => ({ INKIND_CONTRIBUTION: p.rows }),
  invalidates: ["getPre_awardPropinkind"],
});
export const saveInKindLines = write<{ proposalId: string; rows: unknown[] }>({
  op: "postPre_awardPropinkindcostline",
  headers: (p) => ({ proposal_id: p.proposalId }),
  body: (p) => ({ INKIND_ARRAY: p.rows }),
  invalidates: ["getPre_awardPropinkindcostline"],
});
export const deleteInKindLine = write<{ lineId: number }>({
  op: "deletePre_awardPropinkindcostline",
  headers: (p) => ({ id: p.lineId }),
  invalidates: ["getPre_awardPropinkindcostline"],
});
/**
 * WRITES: a proposal (POST /Proposal/proposal): the Summary save, a new proposal, and an opportunity or EOI convert,
 * each with an explicit payload. A convert moves the EOI on, so its held details go too.
 */
export const save = write<{ body: unknown }>({
  op: "postProposalProposal",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  invalidates: [
    "getProposalProposal_id",
    "getPre_awardGetProposalsList",
    "getSharedGetOpportunities",
    "getDynamicFormsGetRequestDetails",
  ],
});
export const deleteCollaborator = write<{ relationId: number }>({
  op: "deletePre_awardDeleteCollaboratorProp_collab_rltn_id",
  path: (p) => ({ prop_collab_rltn_id: String(p.relationId) }),
  invalidates: ["getProposalProposal_id"],
});
