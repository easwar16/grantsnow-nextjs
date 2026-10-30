import "server-only";
import { read, write } from "../client";
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
