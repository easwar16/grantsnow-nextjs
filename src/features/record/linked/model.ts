/** One linked record as the Linked Objects dialog lists it (legacy linkedModulesDialog). */
export interface LinkedRecord {
  id: string;
  name: string;
  status?: string;
  title?: string;
  updatedBy?: string;
  updated?: string;
  /** The in-app route of the record's legacy link; absent when the link is missing or not one of ours. */
  href?: string;
}

/** The dialog's groups in legacy order; a group with no records is left out. */
export interface LinkedGroup {
  key: string;
  label: string;
  records: LinkedRecord[];
}

export type LinkedTextKey =
  "title" | "updatedBy" | "updated" | "noData" | "view" | "none";

export interface LinkedObjects {
  groups: LinkedGroup[];
  texts: Record<LinkedTextKey, string>;
}
