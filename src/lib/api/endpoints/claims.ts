"use client";
import {
  serializeUnitFilters,
  type UnitFilters,
} from "@/features/modules/claims/units/schema";
import type {
  FundTypeOption,
  GrantChoices,
  UnitChoiceList,
  UnitCloneSetup,
  UnitDialogSetup,
  UnitPage,
  UnitRow,
} from "@/features/modules/claims/units/types";
import {
  serializeFundFilters,
  type FundFilters,
} from "@/features/modules/claims/funds/schema";
import type {
  FundPage,
  FundRow,
  FundSummary,
} from "@/features/modules/claims/funds/types";
import type {
  UnitActivityTable,
  UnitActivityView,
  UnitClaimableView,
  UnitActivitiesView,
  UnitActivityList,
  UnitFundSummary,
  UnitAllocationsView,
  UnitGoalDialog,
  UnitGoalsView,
  UnitSignOffList,
} from "@/features/modules/claims/units/types";
import type { SignOffView } from "@/shared/claims/unit-record";
import { del, download, get, post } from "../http";
import { endpoint, pagedEndpoint } from "../hooks";
import { constants } from "@/lib/constants";

/** The Unit Inquiry listing, a page at a time: only the filters that differ from the defaults travel. */
export const units = pagedEndpoint<UnitFilters, UnitRow, UnitPage>(
  (f) => ({
    path: "/claims/units",
    query: Object.fromEntries(
      new URLSearchParams(serializeUnitFilters({ ...f, offset: 0 })),
    ),
  }),
  (b) => ({ rows: b.rows, hasMore: b.hasMore, total: b.total ?? undefined }),
  { size: constants.paging.claims },
);
/** The org units (drawer filter and dialog), held for the session. */
export const unitChoices = endpoint<"orgs", UnitChoiceList>(
  (list) => ({ path: "/claims/units/choices", query: { list } }),
  { ttl: constants.ttl.session },
);
const unitAction = (name: string) => `/claims/units/actions/${name}`;
/** Dialog setups, read fresh on each open as legacy reads them. */
export const unitDialog = () => get<UnitDialogSetup>(unitAction("dialog"));
export const fundTypes = (program: string) =>
  get<FundTypeOption[]>(unitAction("fund-types"), { program });
export const grants = (fundType: string, year: string) =>
  get<GrantChoices>(unitAction("grants"), { fundType, year });
export const unitCloneSetup = () => get<UnitCloneSetup>(unitAction("clone"));
/** WRITES: creates or updates a unit application. */
export const saveUnit = (body: Record<string, unknown>) =>
  post<{ saved: true }>(unitAction("save"), body);
/** WRITES: clones a unit application to another fiscal year; `cloned` is false when the reply has no new app. */
export const cloneUnit = (body: Record<string, unknown>) =>
  post<{ cloned: boolean }>(unitAction("clone"), body);

/** The Funds Inquiry listing, a page at a time. */
export const funds = pagedEndpoint<FundFilters, FundRow, FundPage>(
  (f) => ({
    path: "/claims/funds",
    query: Object.fromEntries(
      new URLSearchParams(serializeFundFilters({ ...f, offset: 0 })),
    ),
  }),
  (b) => ({ rows: b.rows, hasMore: b.hasMore, total: b.total ?? undefined }),
  { size: constants.paging.claims },
);
/** The Funds Inquiry Unit filter's org units, held for the session. */
export const fundChoices = endpoint<"orgs", UnitChoiceList>(
  (list) => ({ path: "/claims/funds/choices", query: { list } }),
  { ttl: constants.ttl.session },
);
/** A fund's account summary (legacy reads it again for another fund). */
export const fundSummary = (id: string, year: string) =>
  get<FundSummary>("/claims/funds/summary", { id, year });
/** WRITES (generate-report): the Unit Inquiry listing's report for the filters (legacy `report-vbcs-app-unit-listing`). */
export const exportUnits = (f: UnitFilters) =>
  download("/claims/units/export", undefined, {
    filters: Object.fromEntries(
      new URLSearchParams(serializeUnitFilters({ ...f, offset: 0 })),
    ),
  });
/** WRITES (generate-report): one application's consolidated report (legacy row Export). */
export const exportUnit = (row: {
  id: string;
  unitId: string;
  fiscalYear: string;
}) =>
  download("/claims/units/export", undefined, {
    appId: row.id,
    unitId: row.unitId,
    fiscalYear: row.fiscalYear,
  });
/** WRITES (generate-report): a fund record's report for the current tab and filter bar (legacy exportReport). */
export const exportFund = (
  appFundId: string,
  body: { tab: string; filters: Record<string, string> },
) => download(`/claims/funds/${appFundId}/export`, undefined, body);
/** A unit Summary sign-off list, read when its tab opens (legacy reads it again on every selection). */
export const signOffList = endpoint<
  { appId: string; view: SignOffView },
  UnitSignOffList
>((p) => ({
  path: `/claims/units/${p.appId}/sign-off`,
  query: { view: p.view },
}));
/** WRITES: adds a sign-off row, or updates `row`; a meeting or document may carry one file. */
export const saveSignOff = (
  appId: string,
  view: SignOffView,
  fields: Record<string, string>,
  file?: File | null,
) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  if (file) body.append("file", file);
  return post<{ saved: "created" | "updated" }>(
    `/claims/units/${appId}/sign-off`,
    body,
    { view },
  );
};
/** WRITES: removes a sign-off row (a meeting's or document's file with it). */
export const deleteSignOff = (appId: string, view: SignOffView, row: string) =>
  del<{ deleted: true }>(`/claims/units/${appId}/sign-off`, { view }, { row });
/** A meeting's or document's file. */
export const signOffFile = (appId: string, view: SignOffView, row: string) =>
  download(`/claims/units/${appId}/sign-off/file`, { view, row });
/** WRITES (generate-report): the stakeholder list or its sign-in sheet. */
export const exportStakeholders = (appId: string, report: "list" | "sign-in") =>
  download(`/claims/units/${appId}/sign-off/export`, undefined, { report });
/** WRITES: the unit Summary's Save (the people and sign-off columns, by column name). */
export const saveUnitSummary = (
  appId: string,
  values: Record<string, string>,
) => post<{ saved: true }>(`/claims/units/${appId}/summary`, { values });
/** A unit fund's Allocation dialog (legacy reads it again after every change). */
export const allocations = endpoint<
  { appId: string; fund: string },
  UnitAllocationsView
>((p) => ({
  path: `/claims/units/${p.appId}/allocations`,
  query: { fund: p.fund },
}));
/** WRITES: adds a fund allocation, or updates the one named by `allocId`. */
export const saveAllocation = (
  appId: string,
  body: {
    fund: string;
    allocId?: string;
    type: string;
    date: string;
    amount: string;
  },
) =>
  post<{ saved: "created" | "updated" }>(
    `/claims/units/${appId}/allocations`,
    body,
  );
/** WRITES: removes a fund allocation. */
export const deleteAllocation = (
  appId: string,
  body: { fund: string; allocId: string },
) =>
  del<{ deleted: true }>(`/claims/units/${appId}/allocations`, undefined, body);
/** A unit application's Goals tab for one fund (the first when `fund` is empty). */
export const goals = endpoint<{ appId: string; fund: string }, UnitGoalsView>(
  (p) => ({
    path: `/claims/units/${p.appId}/goals`,
    query: p.fund ? { fund: p.fund } : {},
  }),
);
/** The add / edit goal dialog: the fund type's goals for the year, and the goal being edited. */
export const goalDialog = endpoint<
  { appId: string; fund: string; goal: string; year: string },
  UnitGoalDialog
>((p) => ({
  path: `/claims/units/${p.appId}/goals`,
  query: {
    view: "dialog",
    fund: p.fund,
    ...(p.goal ? { goal: p.goal } : {}),
    ...(p.year ? { year: p.year } : {}),
  },
}));
/** WRITES: adds a goal, or updates the one named by `goal`. */
export const saveGoal = (
  appId: string,
  body: {
    fund: string;
    goal?: string;
    fiscalYear: string;
    goalId: string;
    description: string;
    evaluation: string;
    reviewerComments: string;
  },
) =>
  post<{ saved: "created" | "updated" }>(`/claims/units/${appId}/goals`, body);
/** WRITES: removes a goal. */
export const deleteGoal = (
  appId: string,
  body: { fund: string; goal: string },
) => del<{ deleted: true }>(`/claims/units/${appId}/goals`, undefined, body);
/** The Assurance sign-off tab: its requirement id (null before the first submit) and the edit gate. */
export const assurance = endpoint<
  string,
  {
    requirementId: string | null;
    editable: boolean;
    audit: string | null;
    texts: Record<"submit" | "saved", string>;
  }
>((appId) => ({ path: `/claims/units/${appId}/assurance` }));
/** WRITES: saves or creates the assurance requirement before its answers; its id. */
export const saveAssurance = (appId: string) =>
  post<{ requirementId: string }>(`/claims/units/${appId}/assurance`);
/** A unit application's Activities tab header for one fund (the first when `fund` is empty). */
export const activities = endpoint<
  { appId: string; fund: string },
  UnitActivitiesView
>((p) => ({
  path: `/claims/units/${p.appId}/activities`,
  query: p.fund ? { fund: p.fund } : {},
}));
/** The Activities tab's Fund Summary table for a fund and period. */
export const activityFundSummary = endpoint<
  { appId: string; fund: string; period: string },
  UnitFundSummary
>((p) => ({
  path: `/claims/units/${p.appId}/activities`,
  query: { view: "fund-summary", fund: p.fund, period: p.period },
}));
/** The Activities tab's list for a fund, optionally of one status. */
export const activityList = endpoint<
  { appId: string; fund: string; status: string },
  UnitActivityList
>((p) => ({
  path: `/claims/units/${p.appId}/activities`,
  query: {
    view: "list",
    fund: p.fund,
    ...(p.status ? { status: p.status } : {}),
  },
}));
/** WRITES: removes one activity version; `warning` when the unapplied balance turned negative. */
export const deleteActivity = (
  appId: string,
  body: { fund: string; activity: string; version: string },
) =>
  del<{
    deleted: true;
    warning: { summary: string; message: string } | null;
  }>(`/claims/units/${appId}/activities`, undefined, body);
type ActivityKey = {
  appId: string;
  fund: string;
  activity: string;
  version: string;
};
const activityQuery = (view: string, p: ActivityKey) => ({
  path: `/claims/units/${p.appId}/activities`,
  query: { view, fund: p.fund, activity: p.activity, version: p.version },
});
/** One activity version on the details tab. */
export const activity = endpoint<ActivityKey, UnitActivityView>((p) =>
  activityQuery("activity", p),
);
/** The activity's claimable amounts per period. */
export const claimable = endpoint<ActivityKey, UnitClaimableView>((p) =>
  activityQuery("claimable", p),
);
/** The activity's amendment history. */
export const amendmentHistory = endpoint<ActivityKey, UnitActivityTable>((p) =>
  activityQuery("amendment-history", p),
);
/** The claim lines charged to the activity. */
export const claimDetails = endpoint<ActivityKey, UnitActivityTable>((p) =>
  activityQuery("claim-details", p),
);
/** WRITES: makes this version the activity's active one. */
export const setActiveVersion = (
  appId: string,
  body: { fund: string; activity: string; version: string },
) => post<{ activated: true }>(`/claims/units/${appId}/activities`, body);
