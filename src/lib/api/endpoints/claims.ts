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
import { download, get, post } from "../http";
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
