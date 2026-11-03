import type { FundTab } from "@/shared/claims/fund-record";

type Option = { value: string; label: string };

/** One fund on one unit application, as the Funds Inquiry listing shows it. */
export interface FundRow {
  id: string;
  unitName: string;
  fiscalYear: string;
  fundName: string;
}
export interface FundPage {
  rows: FundRow[];
  total: number | null;
  hasMore: boolean;
}
export type FundTextKey =
  | "unit"
  | "year"
  | "fund"
  | "func"
  | "object"
  | "fiscalYear"
  | "fundName"
  | "toggle"
  | "view"
  | "clear"
  | "empty"
  | "total";
export interface FundListView {
  /** Legacy gates only the Unit filter on RB; the others always show. */
  gates: { unit: boolean };
  texts: Record<FundTextKey, string>;
  funds: Option[];
  functions: Option[];
  objects: Option[];
  years: Option[];
  errors: string[];
}
/** One function × object line of a fund's account summary (amounts as sent; `spent` as legacy shows it). */
export interface FundSummaryRow {
  key: string;
  func: string;
  object: string;
  year: string;
  original: number | null;
  approved: number | null;
  inProcess: number | null;
  claimed: number | null;
  spent: number | null;
  available: number | null;
}
export interface FundSummary {
  title: string;
  headers: Record<
    | "func"
    | "object"
    | "year"
    | "original"
    | "approved"
    | "inProcess"
    | "claimed"
    | "spent"
    | "available",
    string
  >;
  empty: string;
  rows: FundSummaryRow[];
}

/** The Funds Inquiry record's shell (legacy claims-funds-inquiry-info-page): tabs, the filter bar and Export. */
export interface FundShellModel {
  appFundId: string;
  tabs: { tab: FundTab; name: string }[];
  filters: {
    functions: Option[];
    objects: Option[];
    statuses: Option[];
  };
  /** Legacy shows Export with the record's `claims-export` role; it reports the current tab (not Attachments). */
  canExport: boolean;
  labels: Record<
    "list" | "export" | "func" | "object" | "status" | "tabs",
    string
  >;
}
/** One approved activity on the Budget tab (getActivitiesSummary). */
export interface FundActivityRow {
  key: string;
  number: string;
  type: string;
  status: string;
  cost: number | null;
  itemization: string;
  job: string;
}
/** One claim line on the Claims tab (getClaimLinesSummary). */
export interface FundClaimLineRow {
  key: string;
  number: string;
  period: string;
  date: string;
  status: string;
  amount: number | null;
  description: string;
}
export interface FundTableView<Row> {
  headers: Record<string, string>;
  empty: string;
  rows: Row[];
}
