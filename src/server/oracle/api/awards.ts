import "server-only";
import { read, write } from "../client";
import { serverConstants } from "@/server/constants";

/** Awards (post_awards); bodies come back as read and the services apply their schemas. */
/** One listing page (AwardHeader); `query` is the page, clause and sort exactly as the listing's builder makes them. */
export const list = read<{ query: Record<string, string> }>({
  op: "getPost_awardsAwardHeader",
  query: (p) => p.query,
});
/** One Advanced Query page (advanced-search), same query params as the list; its rows carry the attribute columns. */
export const advancedSearch = read<{ query: Record<string, string> }>({
  op: "getPost_awardsAdvancedSearch",
  query: (p) => p.query,
});
/** The awards already made from a proposal (Awardhierarchy, module AWARD); `count` > 0 means it has its primary. */
export const hierarchy = read<{ proposalId: number }>({
  op: "getPost_awardsAwardhierarchy",
  headers: (p) => ({ proposal_id: p.proposalId, module: "AWARD" }),
});
/** Proposals an award can be made from or linked to (getRelationItem: object_type PROPOSAL, object_status AWARD). */
export const proposals = read<void>({
  op: "getContractsGetRelationItem",
  headers: () => ({ object_type: "PROPOSAL", object_status: "AWARD" }),
});
/** WRITES: the primary award generated from a proposal (GenerateAward, a GET that inserts). */
export const generate = write<{ proposalId: number }>({
  op: "postPost_awardsGenerateAward",
  headers: (p) => ({ proposal_id: p.proposalId }),
  invalidates: ["getPost_awardsAwardHeader", "getPost_awardsAdvancedSearch"],
});
/** WRITES: a new award header (legacy createAward PascalCase payload). */
export const create = write<{ body: unknown }>({
  op: "postPost_awardsAwardHeader",
  body: (p) => p.body,
  invalidates: [
    "getPost_awardsAwardHeader",
    "getPost_awardsAdvancedSearch",
    "getPost_awardsAwardDetails",
  ],
});
/** The parts of an award Clone can copy (copyAwardObjList, AWARD): `r` key, `d` label, `parent_object`, `default_value`. */
export const copyObjects = read<void>({
  op: "getPost_awardsCopyAwardObjList",
  ttl: serverConstants.ttl.config,
  headers: () => ({ p_obj_type: "AWARD" }),
});
/** WRITES: clones an award with the chosen parts ({ award_id, objects: [{ object_name, object_val }] }). */
export const copy = write<{ body: unknown }>({
  op: "postPost_awardsCopyAward",
  body: (p) => p.body,
  invalidates: ["getPost_awardsAwardHeader", "getPost_awardsAdvancedSearch"],
});
/** WRITES: links an award with no proposal to one (link-proposal). */
export const linkProposal = write<{ awardId: number; proposalId: number }>({
  op: "postLinkProposal",
  headers: (p) => ({ "award-id": p.awardId, "proposal-id": p.proposalId }),
  invalidates: [
    "getPost_awardsAwardHeader",
    "getPost_awardsAdvancedSearch",
    "getSharedObjectLinked2",
    "getPost_awardsAwardDetails",
  ],
});
/** One award as its record shows it (AwardDetails): the header, its lists and `locked_modules`. */
export const details = read<{ awardId: string }>({
  op: "getPost_awardsAwardDetails",
  ttl: serverConstants.ttl.access,
  headers: (p) => ({ award_id: p.awardId }),
});
/** The award's periods (AwardPeriodDetails `Award Period Details`); the record's dates span them. */
export const periods = read<{ awardId: string }>({
  op: "getPost_awardsAwardPeriodDetails",
  ttl: serverConstants.ttl.access,
  headers: (p) => ({ p_award_id: p.awardId }),
});
/** WRITES: one award period's dates and amount (the Header's period table). */
export const savePeriod = write<{ body: unknown }>({
  op: "postPost_awardsAwardPeriodDetails",
  body: (p) => p.body,
  invalidates: [
    "getPost_awardsAwardPeriodDetails",
    "getPost_awardsAwardDetails",
  ],
});
/** WRITES: one budget period (AwardBudgetPeriods, UPPER_SNAKE body; BUDGET_PERIOD blank to add one). */
export const saveBudgetPeriod = write<{ body: unknown }>({
  op: "postPost_awardsAwardBudgetPeriods",
  body: (p) => p.body,
  invalidates: ["getPost_awardsAwardDetails"],
});
/** A project's budget against actuals (Project Report): by year for the chart, by year for the table, by month. */
export const reportGraph = read<{ projectId: number }>({
  op: "getPost_awardsActualVsExpenditureGraph",
  headers: (p) => ({ p_project_id: p.projectId }),
});
export const reportYearly = read<{ projectId: number }>({
  op: "getPost_awardsActualVsExpenditureYearly",
  headers: (p) => ({ p_project_id: p.projectId }),
});
export const reportMonthly = read<{ projectId: number }>({
  op: "getPost_awardsActualVsExpenditureMonthly",
  headers: (p) => ({ p_project_id: p.projectId }),
});
/** The due-diligence records linked to an award (getApplicationList: p_obj_ref_id, p_obj_type DUE_DILIGENCE). */
export const dueDiligence = read<{ awardId: string }>({
  op: "getProposalGetApplicationList",
  headers: (p) => ({ p_obj_ref_id: p.awardId, p_obj_type: "DUE_DILIGENCE" }),
});
/** Project roles (GetProjectrole), funding sections (getFundingHdr) and a cost category's items. */
export const projectRoles = read<void>({
  op: "getPost_awardsGetProjectrole",
  ttl: serverConstants.ttl.config,
});
export const fundingSections = read<void>({
  op: "getPre_awards_costingGetFundingHdr",
  ttl: serverConstants.ttl.config,
});
export const costCategoryItems = read<{ type: string }>({
  op: "getPre_awardGetCostCategoryItems",
  ttl: serverConstants.ttl.config,
  headers: (p) => ({ cost_category_type_lkp_code: p.type }),
});
/** One cost line's items by period (AwardPrjCostItem GET). */
export const costItems = read<{
  awardId: number;
  projectId: number;
  groupId: number;
}>({
  op: "getAwardProjectCostItems",
  headers: (p) => ({
    award_id: p.awardId,
    project_id: p.projectId,
    costing_group_id: p.groupId,
  }),
});
const RECORD_READS = ["getPost_awardsAwardDetails"] as const;
/** WRITES: a project (AwardProjects, PascalCase). */
export const saveProject = write<{ body: unknown }>({
  op: "postPost_awardsAwardProjects",
  body: (p) => p.body,
  invalidates: RECORD_READS,
});
/** WRITES: a project team member (AwardPRJTeamMembers, UPPER_SNAKE). */
export const saveTeamMember = write<{ body: unknown }>({
  op: "postPost_awardsAwardPRJTeamMembers",
  body: (p) => p.body,
  invalidates: RECORD_READS,
});
/** WRITES: a cost line or one of its period items (AwardPrjCostItem POST). */
export const saveCostItem = write<{ body: unknown }>({
  op: "postPost_awardsAwardPrjCostItem",
  body: (p) => p.body,
  invalidates: [...RECORD_READS, "getAwardProjectCostItems"],
});
/** WRITES: the award's split, or a section's or category's (AwardPrjCostLine). */
export const saveCostLine = write<{ body: unknown }>({
  op: "postAwardPrjCostLine",
  body: (p) => p.body,
  invalidates: [...RECORD_READS, "getAwardProjectCostItems"],
});
/** WRITES: deletes a whole cost line (its costing group) or one period item. */
export const deleteCost = write<{ groupId: number } | { itemId: number }>({
  op: "deletePost_awardsAwardPrjCostItem",
  headers: (p) =>
    "groupId" in p
      ? { p_costing_group_id: p.groupId }
      : { p_cost_item_id: p.itemId },
  invalidates: [...RECORD_READS, "getAwardProjectCostItems"],
});
/** WRITES: copies a cost line (from its first item). */
export const copyCostItem = write<{ itemId: number }>({
  op: "postPost_awardsCopyAwardPrjCostItem",
  headers: (p) => ({ p_award_cost_item_id: p.itemId }),
  invalidates: RECORD_READS,
});
/** The tenant's ERP target (custErpDetails, module AWARD): `erp_type` and the OIC flow path legacy posts to. */
export const erpDetails = read<void>({
  op: "getSharedCustErpDetails2",
  headers: () => ({ module_name: "AWARD" }),
});
/**
 * WRITES: an award's credit allocation rows (legacy postProposalCreditAllocation, on the award's proposal period
 * version): `[{credit_alloc_id, credit_pct, prj_effort}]`, fractions; it updates existing rows only.
 */
export const saveCredit = write<{ periodVersionId: number; body: unknown }>({
  op: "postProposalCreditAllocation",
  headers: (p) => ({ p_prop_period_version_id: p.periodVersionId }),
  body: (p) => p.body,
  invalidates: ["getPost_awardsAwardDetails"],
});
