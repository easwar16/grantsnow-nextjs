/** Display models of the shared object History and Delegation panels; built on the server, never raw Oracle bodies. */
export interface Choice {
  value: string;
  label: string;
}
export interface HistoryRow {
  id: string;
  status: string;
  mode: string;
  comments: string;
  user: string;
  date: string;
}
export interface ApprovalRow {
  id: string;
  name: string;
  status: string;
  stage: string;
  comments: string;
  updated: string;
}
export type HistoryTextKey =
  | "title"
  | "addStatus"
  | "abandon"
  | "status"
  | "mode"
  | "comments"
  | "user"
  | "date"
  | "noData"
  | "approvalTitle"
  | "approvalName"
  | "approvalStatus"
  | "approvalStage"
  | "approvalComments"
  | "approvalUpdated"
  | "approvalNoData"
  | "dialogTitle"
  | "statusLabel"
  | "commentPlaceholder"
  | "responseDate"
  | "cancel"
  | "save"
  | "commentsTitle";
export interface HistoryView {
  texts: Record<HistoryTextKey, string>;
  rows: HistoryRow[];
  /** null when the bundle hides approval history; `error` when it could not be read. */
  approvals: { rows: ApprovalRow[] } | { error: string } | null;
  gates: {
    addStatus: boolean;
    abandon: boolean;
    /** Both actions stay visible but disabled once the object is abandoned. */
    abandoned: boolean;
    /** The response date field may show for an AWARD / DEC status. */
    responseDate: boolean;
  };
}
/** Statuses whose insert carries the actual response date (legacy object-history-fragment.html:161). */
export const RESPONSE_DATE_STATUSES = ["AWARD", "DEC"];
export const ABANDON = "ABANDON";

export type ComponentType = "PAGE" | "BUTTON" | "PRIVILEGE" | "OTHER";
export const COMPONENT_ORDER: ComponentType[] = [
  "PAGE",
  "BUTTON",
  "PRIVILEGE",
  "OTHER",
];
export interface DelegatedPage {
  /** The delegation row id (per page). */
  id: string;
  name: string;
  label: string;
  read: boolean;
  edit: boolean;
  delete: boolean;
  /** The host's default page: read stays on and it cannot be removed. */
  locked: boolean;
}
export interface Delegate {
  personId: string;
  name: string;
  /** yyyy-mm-dd, "" for none. */
  start: string;
  end: string;
  groups: { type: ComponentType; label: string; pages: DelegatedPage[] }[];
}
export type DelegationTextKey =
  | "add"
  | "noData"
  | "read"
  | "edit"
  | "delete"
  | "remove"
  | "editAccess"
  | "from"
  | "to"
  | "dialogTitle"
  | "people"
  | "privilege"
  | "startDate"
  | "endDate"
  | "all"
  | "submit"
  | "deleteTitle"
  | "deleteMessage"
  | "deleteYes"
  | "deleteNo"
  | ComponentType;
export interface DelegationView {
  texts: Record<DelegationTextKey, string>;
  delegates: Delegate[];
  /** The pages the user may delegate (their own readable pages on the object), grouped. */
  catalogue: {
    type: ComponentType;
    label: string;
    pages: { name: string; label: string; locked: boolean }[];
  }[];
  gates: {
    /** RBAC on the host's delegation page (fail closed). */
    edit: boolean;
    delete: boolean;
    /** RB visibility. */
    editAccess: boolean;
    deleteDelegate: boolean;
    from: boolean;
    to: boolean;
    /** RB mandatory flags. */
    peopleRequired: boolean;
    startRequired: boolean;
    endRequired: boolean;
  };
}
