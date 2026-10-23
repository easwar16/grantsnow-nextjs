/** What every record page passes to its comments and audit trail (D38). */
export interface ObjectPanelProps {
  /** The panel's page-unique id; its parts derive theirs from it. */
  id: string;
  /** The backend object type, e.g. `OPPORTUNITIES-EOI`; the server resolves the host from it. */
  objectType: string;
  objectId: string;
  /** The record page the user is on; comments and audits are kept per page. */
  page: string;
}
/** The panels' route query: the record and the page, never identity or scope. */
export const panelQuery = ({ objectType, objectId, page }: ObjectPanelProps) =>
  new URLSearchParams({ type: objectType, id: objectId, page }).toString();

export const COMMENT_LABELS = [
  "noData",
  "edit",
  "delete",
  "send",
  "cancel",
  "submit",
  "editTitle",
] as const;
export type CommentLabel = (typeof COMMENT_LABELS)[number];
export interface CommentItem {
  id: number;
  /** Sanitised on the server. */
  html: string;
  author: string;
  at: string;
  /** The author's own comment, shown on the brand side. */
  own: boolean;
  /** Edit and Delete show: own comment and the user may comment. */
  canChange: boolean;
}
export interface CommentsView {
  items: CommentItem[];
  labels: Record<CommentLabel, string>;
  maxLength: number;
  /** The over-limit warning, `{num}` already filled in. */
  warning: string;
  canComment: boolean;
}

export const AUDIT_EVENTS = ["ALL", "INSERTED", "UPDATED", "DELETED"] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];
export interface AuditEntry {
  /** Stable within the list: the entry has no id of its own. */
  key: string;
  event: Exclude<AuditEvent, "ALL"> | string;
  name: string;
  at: string;
  fields: { name: string; value: string; old: string }[];
}
export interface AuditView {
  items: AuditEntry[];
  noData: string;
}
