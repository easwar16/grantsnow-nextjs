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

/** The application's requirements (unit-inquiry/{appId}/requirements): of one type, of one fund, or all. */
export const requirements = read<{
  appId: number;
  orgId: string;
  type?: string;
  appFundId?: number;
}>({
  op: "getRequirements",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => ({
    ...(p.type ? { "req-type-code": p.type } : {}),
    ...(p.appFundId ? { "app-fund-id": String(p.appFundId) } : {}),
  }),
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
export const fundCategories = read<{
  appFundId: number;
  orgId: string;
  /** Whose category counts: the activities' (Activities tab) or the claims' (Claims tab). */
  objectType?: "ACTIVITY" | "CLAIM";
}>({
  op: "getFundsCategories",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => ({
    "include-category": "Y",
    "object-type": p.objectType ?? "ACTIVITY",
  }),
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
  /** An amendment's picker: the activities as that amendment sees them (legacy loadActivityList). */
  amendmentId?: number;
}>({
  op: "getActivities",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({
    "org-id": p.orgId,
    ...(p.amendmentId ? { "amendment-id": String(p.amendmentId) } : {}),
  }),
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
/** A fund type's activity, function and object codes (legacy loadFundActivityTypeCodes); a grant category narrows them. */
export const activityTypeCodes = read<{
  fundTypeId: number;
  grantCategoryId?: number;
}>({
  op: "getFundActivityTypeCodes",
  query: (p) => ({
    "fund-type-id": String(p.fundTypeId),
    ...(p.grantCategoryId
      ? { "grant-category-id": String(p.grantCategoryId) }
      : {}),
  }),
});
/** The benefit and purchase-service categories with their default method and rate (legacy loadCategoryConfig). */
export const categoryConfigs = read<Record<string, never>>({
  op: "getCategoryConfigs",
});
const ACTIVITY_READS = [
  "getClaimsActivity",
  "getActivityVersions",
  "getActivities",
  "getFundsCategories",
  "getActivitySummary",
] as const;
/** WRITES: creates an activity on a fund (legacy saveActivity, postActivities); an amendment passes its id. */
export const createActivity = write<{
  appFundId: number;
  amendmentId?: number;
  body: unknown;
}>({
  op: "postActivities",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) =>
    p.amendmentId ? { "amendment-id": String(p.amendmentId) } : {},
  body: (p) => p.body,
  invalidates: ACTIVITY_READS,
});
/** WRITES: saves one version of an activity (legacy saveActivity, putClaimsActivity). */
export const updateActivity = write<{
  activityId: number;
  versionId: number;
  body: unknown;
}>({
  op: "putClaimsActivity",
  path: (p) => ({
    activity_id: String(p.activityId),
    amend_version_id: String(p.versionId),
  }),
  body: (p) => p.body,
  invalidates: ACTIVITY_READS,
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

const AMENDMENT_READS = [
  "getActivityAmendments",
  "getAmendmentLines",
  "getActivities",
  "getFundsCategories",
] as const;
/** A fund's amendments, optionally of one status (legacy loadAmendmentsList). */
export const amendments = read<{
  appFundId: number;
  orgId: string;
  status: string;
}>({
  op: "getActivityAmendments",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => ({ status: p.status }),
});
/** One amendment's lines: each activity it changes, current against amended (legacy loadAmendmentLines). */
export const amendmentLines = read<{ amendmentId: number }>({
  op: "getAmendmentLines",
  path: (p) => ({ amendment_id: String(p.amendmentId) }),
});
/** WRITES: brings existing activities into an amendment; the first include mints it (legacy includeActivity). */
export const includeInAmendment = write<{
  appFundId: number;
  amendmentId?: number;
  body: unknown;
}>({
  op: "postIncludeAmendActivity",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) =>
    p.amendmentId ? { "amendment-id": String(p.amendmentId) } : {},
  body: (p) => p.body,
  invalidates: AMENDMENT_READS,
});
/** WRITES: saves an amendment's reason (legacy saveAmendment). */
export const saveAmendment = write<{ amendmentId: number; body: unknown }>({
  op: "putAmendment",
  path: (p) => ({ amendment_id: String(p.amendmentId) }),
  body: (p) => p.body,
  invalidates: AMENDMENT_READS,
});
/** WRITES: removes an amendment (legacy deleteAmendment). */
export const deleteAmendment = write<{ amendmentId: number }>({
  op: "deleteAmendment",
  path: (p) => ({ amendment_id: String(p.amendmentId) }),
  invalidates: AMENDMENT_READS,
});
/** WRITES: removes one line (activity version) from an amendment (legacy deleteAmendmentLine). */
export const deleteAmendmentLine = write<{
  amendmentId: number;
  versionId: number;
}>({
  op: "deleteAmendmentLine",
  path: (p) => ({
    amendment_id: String(p.amendmentId),
    amend_version_id: String(p.versionId),
  }),
  invalidates: AMENDMENT_READS,
});

/** The application's staff roster (legacy loadRoster). */
export const roster = read<{ appId: number; orgId: string }>({
  op: "getRoster",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** A fund's job titles for the roster (legacy loadRosterJobTitles, `?app-fund-id=`). */
export const rosterJobTitles = read<{ appId: number; appFundId: number }>({
  op: "getRosterJobTitles",
  path: (p) => ({ app_id: String(p.appId) }),
  query: (p) => ({ "app-fund-id": String(p.appFundId) }),
});
/** WRITES: adds a roster member (legacy saveRosterItem, postRoster). */
export const createRoster = write<{ appId: number; body: unknown }>({
  op: "postRoster",
  path: (p) => ({ app_id: String(p.appId) }),
  body: (p) => p.body,
  invalidates: ["getRoster"],
});
/** WRITES: saves a roster member (legacy saveRosterItem, putRoster). */
export const updateRoster = write<{ rosterId: number; body: unknown }>({
  op: "putRoster",
  path: (p) => ({ roster_id: String(p.rosterId) }),
  body: (p) => p.body,
  invalidates: ["getRoster"],
});
/** WRITES: removes a roster member (legacy deleteRosterItem). */
export const deleteRoster = write<{ rosterId: number }>({
  op: "deleteRoster",
  path: (p) => ({ roster_id: String(p.rosterId) }),
  invalidates: ["getRoster"],
});
/** The application's furniture and equipment (legacy loadEquipmentsList). */
export const equipments = read<{ appId: number; orgId: string }>({
  op: "getEquipments",
  path: (p) => ({ app_id: String(p.appId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** WRITES: adds an item (legacy saveEquipment, postEquipment). */
export const createEquipment = write<{ appId: number; body: unknown }>({
  op: "postEquipment",
  path: (p) => ({ app_id: String(p.appId) }),
  body: (p) => p.body,
  invalidates: ["getEquipments"],
});
/** WRITES: saves an item (legacy saveEquipment, putEquipment). */
export const updateEquipment = write<{ equipmentId: number; body: unknown }>({
  op: "putEquipment",
  path: (p) => ({ equipment_id: String(p.equipmentId) }),
  body: (p) => p.body,
  invalidates: ["getEquipments"],
});
/** WRITES: removes an item (legacy deleteEquipment). */
export const deleteEquipment = write<{ equipmentId: number }>({
  op: "deleteEquipment",
  path: (p) => ({ equipment_id: String(p.equipmentId) }),
  invalidates: ["getEquipments"],
});
/** The fund's claims, by status (`''` for all; legacy loadClaimsList / loadFundSummary's figures). */
export const fundClaims = read<{
  appFundId: number;
  orgId: string;
  status: string;
}>({
  op: "getFundClaims",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  headers: (p) => ({ "org-id": p.orgId }),
  query: (p) => ({ status: p.status }),
});
/** Claimed and available amounts by function and object code (legacy loadClaimsSummary). */
export const claimsSummary = read<{ appFundId: number }>({
  op: "getClaimsSummary",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
});
/** WRITES: a copy of an approved or paid claim (legacy cloneClaim). */
export const cloneClaim = write<{ claimId: number }>({
  op: "postClaimsClone",
  path: (p) => ({ claim_id: String(p.claimId) }),
  invalidates: ["getFundClaims", "getClaimsSummary", "getFundsCategories"],
});
/** WRITES: removes a claim (legacy deleteClaim). */
export const deleteClaim = write<{ claimId: number }>({
  op: "deleteFundClaims",
  path: (p) => ({ claim_id: String(p.claimId) }),
  invalidates: ["getFundClaims", "getClaimsSummary", "getFundsCategories"],
});
/** One claim's header (legacy getFundClaim, read after a save). */
export const fundClaim = read<{ claimId: number }>({
  op: "getFundClaim",
  path: (p) => ({ claim_id: String(p.claimId) }),
});
/** A claim's lines (legacy loadClaimLines). */
export const claimLines = read<{ claimId: number }>({
  op: "getClaimLines",
  path: (p) => ({ claim_id: String(p.claimId) }),
});
/** The fund's activities as a tree for the claim line picker (legacy loadActivityHierarchy). */
export const activityHierarchy = read<{ appFundId: number }>({
  op: "getActivityCodesHierarchy",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
});
/** The fund's rejected claim lines for a period (legacy loadRejectedClaimLines; `claim-id` once the claim exists). */
export const rejectedLines = read<{
  appFundId: number;
  period: number;
  claimId?: number;
}>({
  op: "getRejectedLines",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  query: (p) => ({
    "claim-period": String(p.period),
    ...(p.claimId ? { "claim-id": String(p.claimId) } : {}),
  }),
});
const CLAIM_READS = [
  "getFundClaims",
  "getFundClaim",
  "getClaimLines",
  "getClaimsSummary",
  "getFundsCategories",
  "getRejectedLines",
] as const;
/** WRITES: a new claim with its lines (legacy saveClaim, postFundClaims). */
export const createClaim = write<{ appFundId: number; body: unknown }>({
  op: "postFundClaims",
  path: (p) => ({ app_fund_id: String(p.appFundId) }),
  body: (p) => p.body,
  invalidates: CLAIM_READS,
});
/** WRITES: a claim's period and lines (legacy saveClaim, putClaim). */
export const updateClaim = write<{ claimId: number; body: unknown }>({
  op: "putClaim",
  path: (p) => ({ claim_id: String(p.claimId) }),
  body: (p) => p.body,
  invalidates: CLAIM_READS,
});
const ADJUSTMENT_READS = [
  "getClaimAdjustments",
  "getClaimAdjustment",
  "getClaimAdjustmentLines",
  "getFundClaims",
  "getClaimLines",
] as const;
/** A claim's adjustments (legacy loadAdjustmentsList). */
export const adjustments = read<{ claimId: number; orgId: string }>({
  op: "getClaimAdjustments",
  path: (p) => ({ claim_id: String(p.claimId) }),
  headers: (p) => ({ "org-id": p.orgId }),
});
/** One adjustment's header (legacy getClaimAdjustment, read after a save). */
export const adjustment = read<{ adjustmentId: number }>({
  op: "getClaimAdjustment",
  path: (p) => ({ adjustment_id: String(p.adjustmentId) }),
});
/** An adjustment's lines (legacy loadAdjustmentLines). */
export const adjustmentLines = read<{ adjustmentId: number }>({
  op: "getClaimAdjustmentLines",
  path: (p) => ({ adjustment_id: String(p.adjustmentId) }),
});
/** WRITES: a new adjustment on a claim (legacy saveAdjustmentLines, postClaimAdjustments). */
export const createAdjustment = write<{ claimId: number; body: unknown }>({
  op: "postClaimAdjustments",
  path: (p) => ({ claim_id: String(p.claimId) }),
  body: (p) => p.body,
  invalidates: ADJUSTMENT_READS,
});
/** WRITES: an adjustment's header and lines (legacy saveAdjustmentLines, putClaimAdjustment). */
export const updateAdjustment = write<{ adjustmentId: number; body: unknown }>({
  op: "putClaimAdjustment",
  path: (p) => ({ adjustment_id: String(p.adjustmentId) }),
  body: (p) => p.body,
  invalidates: ADJUSTMENT_READS,
});
/** WRITES: removes an adjustment (legacy deleteAdjustment). */
export const deleteAdjustment = write<{ adjustmentId: number }>({
  op: "deleteClaimAdjustment",
  path: (p) => ({ adjustment_id: String(p.adjustmentId) }),
  invalidates: ADJUSTMENT_READS,
});
