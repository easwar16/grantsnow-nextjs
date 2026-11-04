import "server-only";
import { read, write } from "../client";
import type { Operation } from "../connection";
import { serverConstants } from "@/server/constants";

/** Claims (the `/claims` ORDS family); bodies come back as read and the services apply their schemas. */
/** One page of the Unit Inquiry listing (unit-funds-list): the drawer filters, `offset` / `limit` as legacy's paging transform. */
export const unitList = read<{ orgId: string; query: Record<string, string> }>({
  op: "getUnitFundsList",
  identity: ["org_id"],
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => p.query,
});
/** The org units a unit application can belong to (get-org-units), held for the session as legacy holds them. */
export const orgUnits = read<{ orgId: string }>({
  op: "getClaimsOrgUnits",
  ttl: serverConstants.ttl.session,
  headers: (p) => ({ "org-id": p.orgId }),
});
/** The fund types of one program type (fund-types `program-type-code`). */
export const fundTypes = read<{ programType: string }>({
  op: "getFundTypes",
  query: (p) => ({ "program-type-code": p.programType }),
});
/** The grants a fund type offers in a fiscal year (grant-values; `fy-code` is the plain end year). */
export const grantValues = read<{ fundTypeId: number; fiscalYear: number }>({
  op: "getGrantValues",
  query: (p) => ({ "fund-type-id": p.fundTypeId, "fy-code": p.fiscalYear }),
});
/** WRITES: creates a unit application, or updates it when the body carries `app_id` (unit-inquiry). */
export const saveUnit = write<{ body: unknown }>({
  op: "postUnitInquiry",
  body: (p) => p.body,
  invalidates: ["getUnitFundsList", "getFundInquiries"],
});
/** The parts Clone can copy (copy-claim-obj-list): `r` key, `d` label, `parent_object`, `default_value`. */
export const copyObjects = read<void>({ op: "getCopyClaimObjList" });
/** WRITES: copies a unit application to another fiscal year ({ app_id, copy_to_fiscal_year, objects }). */
export const copy = write<{ body: unknown }>({
  op: "postCopyClaimApp",
  body: (p) => p.body,
  invalidates: ["getUnitFundsList", "getFundInquiries"],
});
/** One page of the Funds Inquiry listing (fund-inquiry). */
export const fundList = read<{ orgId: string; query: Record<string, string> }>({
  op: "getFundInquiries",
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => p.query,
});
/** A fund's budget against claims per function and object code (fund-inquiry/account-summaries). */
export const accountSummaries = read<{ appFundId: number }>({
  op: "getAccountSummaries",
  headers: (p) => ({ "app-fund-id": p.appFundId }),
});
/** A fund's approved activities, filtered by function and object code (fund-inquiry/activities-summary). */
export const activitiesSummary = read<{
  appFundId: number;
  functionCode: string;
  objectCode: string;
}>({
  op: "getActivitiesSummary",
  headers: (p) => ({ "app-fund-id": p.appFundId }),
  query: (p) => ({
    "function-code": p.functionCode,
    "object-code": p.objectCode,
  }),
});
/** A fund's claim lines, filtered by function, object and status (fund-inquiry/claim-lines-summary, `status-type`). */
export const claimLinesSummary = read<{
  appFundId: number;
  functionCode: string;
  objectCode: string;
  status: string;
}>({
  op: "getClaimLinesSummary",
  headers: (p) => ({ "app-fund-id": p.appFundId, "status-type": p.status }),
  query: (p) => ({
    "function-code": p.functionCode,
    "object-code": p.objectCode,
  }),
});
/** A unit application's header row (app-summary): unit, fiscal year, program type and the sign-off people. */
export const appSummary = read<{ appId: number; orgId: string }>({
  op: "getAppSummary",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** A unit application's funds with their allocation totals (app-summary/fund-summary). */
export const appFundSummary = read<{ appId: number; orgId: string }>({
  op: "getFundSummary",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** The application's consultation stakeholders (unit-inquiry stakeholders). */
export const stakeholders = read<{ appId: number; orgId: string }>({
  op: "getStakeholders",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** The application's consultation meetings (unit-inquiry meetings). */
export const meetings = read<{ appId: number; orgId: string }>({
  op: "getMeetings",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** The application's org documents (unit-inquiry documents). */
export const documents = read<{ appId: number; orgId: string }>({
  op: "getDocuments",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** WRITES: the application's header row with its people and sign-offs (app-summary PUT). */
export const saveAppSummary = write<{ appId: number; body: unknown }>({
  op: "putAppSummary",
  path: (p) => ({ app_id: String(p.appId) }),
  body: (p) => p.body,
  invalidates: ["getAppSummary", "getUnitFundsList"],
});
/** Which statuses allow a user edit, per claims transaction type (status-configs `transaction-type`, comma-joined). */
export const statusConfigs = read<{ types: string[] }>({
  op: "getClaimsStatusConfigs",
  query: (p) => ({ "transaction-type": p.types.join(",") }),
});
/** One application fund's allocations (funds/{appFundId}/allocations). */
export const fundAllocations = read<{ appFundId: number; orgId: string }>({
  op: "getFundAllocations",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** WRITES: a new allocation on an application fund. */
export const createAllocation = write<{ appFundId: number; body: unknown }>({
  op: "postFundAllocation",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  body: (p) => p.body,
  invalidates: ["getFundAllocations", "getFundSummary", "getUnitFundsList"],
});
/** WRITES: an allocation's type, date and amount. */
export const updateAllocation = write<{ allocId: number; body: unknown }>({
  op: "putFundAllocations",
  path: (p) => ({ alloc_id: String(p.allocId) }),
  body: (p) => p.body,
  invalidates: ["getFundAllocations", "getFundSummary", "getUnitFundsList"],
});
/** WRITES: removes an allocation. */
export const deleteAllocation = write<{ allocId: number }>({
  op: "deleteFundAllocation",
  path: (p) => ({ alloc_id: String(p.allocId) }),
  invalidates: ["getFundAllocations", "getFundSummary", "getUnitFundsList"],
});
/** A unit application's funds (unit-inquiry/{appId}/funds), each with its status and fund type. */
export const appFunds = read<{ appId: number; orgId: string }>({
  op: "getAppFunds",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** One application fund's goals (unit-inquiry/{appFundId}/goals). */
export const goals = read<{ appFundId: number; orgId: string }>({
  op: "getGoals",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** One goal with its linked activities (goals/{appGoalId}). */
export const goalDetails = read<{ appGoalId: number }>({
  op: "getGoalDetails",
  path: (p) => ({ app_goal_id: String(p.appGoalId) }),
});
/** The goals a fund type offers in a fiscal year (fund-goals, `app-id` header). */
export const fundGoals = read<{
  appId: number;
  fundTypeId?: number;
  fiscalYear?: number;
}>({
  op: "getFundGoals",
  headers: (p) => ({ "app-id": p.appId }),
  query: (p) => ({
    ...(p.fundTypeId !== undefined ? { "fund-type-id": p.fundTypeId } : {}),
    ...(p.fiscalYear !== undefined ? { "fy-code": p.fiscalYear } : {}),
  }),
});
/** WRITES: a new goal on an application fund. */
export const createGoal = write<{ appFundId: number; body: unknown }>({
  op: "postGoals",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  body: (p) => p.body,
  invalidates: ["getGoals", "getGoalDetails"],
});
/** WRITES: a goal's selection, description, evaluation and reviewer comments. */
export const updateGoal = write<{ appGoalId: number; body: unknown }>({
  op: "putGoals",
  path: (p) => ({ app_goal_id: String(p.appGoalId) }),
  body: (p) => p.body,
  invalidates: ["getGoals", "getGoalDetails"],
});
/** WRITES: removes a goal. */
export const deleteGoal = write<{ appGoalId: number }>({
  op: "deleteGoals",
  path: (p) => ({ app_goal_id: String(p.appGoalId) }),
  invalidates: ["getGoals", "getGoalDetails"],
});

/** Sign-off list writes (stakeholders, meetings, org documents): one create / update / delete per list. */
const signOffWrite = (
  op: Operation,
  path: (p: { appId?: number; id?: number }) => Record<string, string>,
  invalidates: Operation[],
) =>
  write<{ appId?: number; id?: number; body?: unknown }>({
    op,
    path,
    body: (p) => p.body,
    invalidates,
  });
const app = (p: { appId?: number }) => ({ app_id: String(p.appId) });
/** WRITES: a consultation stakeholder (first and last name, email, role). */
export const createStakeholder = signOffWrite("postStakeholders", app, [
  "getStakeholders",
]);
export const updateStakeholder = signOffWrite(
  "putStakeholders",
  (p) => ({ stakeholder_id: String(p.id) }),
  ["getStakeholders"],
);
export const deleteStakeholder = signOffWrite(
  "deleteStakeholder",
  (p) => ({ stakeholder_id: String(p.id) }),
  ["getStakeholders"],
);
/** WRITES: a consultation meeting (date, description, sign-in sheet attachment). */
export const createMeeting = signOffWrite("postMeetings", app, ["getMeetings"]);
export const updateMeeting = signOffWrite(
  "putMeetings",
  (p) => ({ meeting_id: String(p.id) }),
  ["getMeetings"],
);
export const deleteMeeting = signOffWrite(
  "deleteMeetings",
  (p) => ({ meeting_id: String(p.id) }),
  ["getMeetings"],
);
/** WRITES: an org document (type, description, attachment). */
export const createDocument = signOffWrite("postDocuments", app, [
  "getDocuments",
]);
export const updateDocument = signOffWrite(
  "putDocuments",
  (p) => ({ doc_id: String(p.id) }),
  ["getDocuments"],
);
export const deleteDocument = signOffWrite(
  "deleteDocuments",
  (p) => ({ doc_id: String(p.id) }),
  ["getDocuments"],
);

/** The application's requirements of one type (unit-inquiry/{appId}/requirements, `req-type-code`). */
export const requirements = read<{
  appId: number;
  orgId: string;
  type: string;
}>({
  op: "getRequirements",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => ({ "req-type-code": p.type }),
});
/** WRITES: a new requirement on the application (the Assurance form's record). */
export const createRequirement = write<{ appId: number; body: unknown }>({
  op: "postRequirement",
  path: (p) => ({ app_id: String(p.appId) }),
  body: (p) => p.body,
  invalidates: ["getRequirements"],
});
/** WRITES: a requirement as read, saved again before its form's answers. */
export const updateRequirement = write<{ id: number; body: unknown }>({
  op: "putRequirement",
  path: (p) => ({ app_requirement_id: String(p.id) }),
  body: (p) => p.body,
  invalidates: ["getRequirements"],
});
/** A fund's activity header: status, budget, balances and per-category counts (legacy loadActivitySummary). */
export const fundCategories = read<{ appFundId: number; orgId: string }>({
  op: "getFundsCategories",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: () => ({ "include-category": "Y", "object-type": "ACTIVITY" }),
});
/** The fund's budget by function and object code for a period (legacy loadFundSummary). */
export const activitySummary = read<{ appFundId: number; period: string }>({
  op: "getActivitySummary",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  query: (p) => ({ period: p.period }),
});
/** The fund's activities, optionally of one status (legacy loadActivityList). */
export const activities = read<{
  appFundId: number;
  orgId: string;
  status: string;
}>({
  op: "getActivities",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => ({ status: p.status }),
});
/** WRITES: removes one version of an activity (legacy deleteActivity). */
export const deleteActivity = write<{ activityId: number; versionId: number }>({
  op: "deleteClaimsActivity",
  path: (p) => ({
    activity_id: String(p.activityId),
    amend_version_id: String(p.versionId),
  }),
  invalidates: ["getActivities", "getFundsCategories", "getActivitySummary"],
});
/** One activity version, with its position type and cost items (legacy loadActivityDetails). */
export const activity = read<{ activityId: number; versionId: number }>({
  op: "getClaimsActivity",
  path: (p) => ({
    activity_id: String(p.activityId),
    amend_version_id: String(p.versionId),
  }),
});
/** The activity's versions (legacy loadActivityVersions). */
export const activityVersions = read<{ activityId: number }>({
  op: "getActivityVersions",
  path: (p) => ({ act_id: String(p.activityId) }),
});
/** WRITES: makes a version the activity's active one (legacy setActiveVersion). */
export const setActiveVersion = write<{
  activityId: number;
  versionId: number;
}>({
  op: "postActivitiesAmendVersions",
  path: (p) => ({ act_id: String(p.activityId) }),
  headers: (p) => ({ "amend-vrsn-id": String(p.versionId) }),
  invalidates: [
    "getClaimsActivity",
    "getActivityVersions",
    "getActivities",
    "getFundsCategories",
    "getActivitySummary",
  ],
});
/** The server's suggested claimable amounts per period (legacy loadClaimableAmounts). */
export const claimableAmounts = read<{ activityId: number; versionId: number }>(
  {
    op: "getClaimableAmounts",
    headers: (p) => ({
      "act-id": String(p.activityId),
      "amend-vrsn-id": String(p.versionId),
    }),
  },
);
/** The activity's amendments (legacy loadAmendmentHistory). */
export const amendmentHistory = read<{ activityId: number }>({
  op: "getClaimsAmendmentHistory",
  path: (p) => ({ activity_id: String(p.activityId) }),
});
/** The claim lines charged to the activity (legacy loadClaimDetails). */
export const claimDetails = read<{ activityId: number }>({
  op: "getClaimDetails",
  path: (p) => ({ act_id: String(p.activityId) }),
});
