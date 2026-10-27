import type { StatusTone } from "@/components/ui/status-badge";

/** One request as the list shows it; a field is absent when empty or when its RB gate hides it. */
export interface EoiListRow {
  id: string;
  number?: string;
  status?: string;
  tone?: StatusTone;
  title?: string;
  funders: string[];
  createdBy?: string;
  department?: string;
  created?: string;
  updated?: string;
  logo?: string;
}

export interface EoiListPage {
  rows: EoiListRow[];
  /** allRequests' `totalcount`; null when the reply has none. */
  total: number | null;
  hasMore: boolean;
}

export interface EoiChoice {
  value: string;
  label: string;
}

/** RB `is_visible` gates (fail closed) for the drawer and the row. */
export interface EoiListGates {
  statusList: boolean;
  number: boolean;
  title: boolean;
  funder: boolean;
  department: boolean;
  createdBy: boolean;
  dateSort: boolean;
  createdAfter: boolean;
  createdBefore: boolean;
  clear: boolean;
  status: boolean;
  createdOn: boolean;
  updatedOn: boolean;
  view: boolean;
}

export type EoiListTextKey =
  | "pageTitle"
  | "empty"
  | "statusList"
  | "status"
  | "number"
  | "title"
  | "funder"
  | "department"
  | "createdBy"
  | "dateSort"
  | "createdAfter"
  | "createdBefore"
  | "clear"
  | "createdOn"
  | "updatedOn"
  | "view"
  | "total";

/** Everything the page needs besides the rows: gates, bundle texts and the drawer's choices. */
export interface EoiListView {
  gates: EoiListGates;
  texts: Record<EoiListTextKey, string>;
  statuses: EoiChoice[];
  funders: EoiChoice[];
  sorts: EoiChoice[];
  /** Choices that failed to load and should be reported (the original toasts statuses and funders only). */
  errors: string[];
}
