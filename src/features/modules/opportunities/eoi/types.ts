import type { StatusTone } from "@/components/ui/status-badge";
import type { IconName } from "@/components/ui/icon";
import type { EoiTab, PageLock } from "@/shared/opportunities/eoi-record";
export type { EoiTab, PageLock };
/** One read-only Summary cell; `html` is sanitised on the server. */
export interface SummaryField {
  key: string;
  label: string;
  text?: string;
  html?: string;
  href?: string;
  /** Spans both columns (summary, eligibility). */
  wide?: boolean;
}
/** The Summary tab as the server allows it to be shown: hidden fields are already left out. */
export interface SummaryView {
  heading: string;
  link?: string;
  logo?: string;
  side: SummaryField[];
  details: SummaryField[];
  counts: { label: string; value: string }[];
  /** The closed-opportunity message, or null while it takes applications. */
  closedMessage: string | null;
  /** The detail page's buttons, by their label; null when not allowed. */
  actions: {
    apply: string | null;
    convert: string | null;
    convertToProposal: string | null;
  };
}
/** What the detail page's actions need besides the view (the deadline warning and the convert dialog). */
export interface SummaryActionContext {
  opportunityId: string;
  closingAt?: string;
  /** The closing date as the app's date format shows it. */
  closingDisplay?: string;
  deadlineWarningDays: number | null;
  texts: Record<
    "deadlineTitle" | "deadlineMessage" | "closingDate" | "continue" | "cancel",
    string
  >;
}
export interface RecordTabLink {
  tab: EoiTab;
  name: string;
  icon: IconName;
  finalized: boolean;
}
/**
 * The record container's display model (allowlisted, no raw API body): `record` a saved application, `new` an
 * application not created yet (Summary + Application), `detail` More Info (the summary alone, no tabs).
 */
export interface RecordShellModel {
  mode: "record" | "new" | "detail";
  /** `/opportunities/eoi/<request>` or `/opportunities/eoi/new/<opportunity>`; tabs are `<base>/<tab>`. */
  base: string;
  listHref: string;
  requestId?: string;
  number?: string;
  statusCode?: string;
  opportunityId?: string;
  opportunityHeading?: string;
  tabs: RecordTabLink[];
  panel: {
    key: string;
    label: string;
    value: string;
    tone?: StatusTone;
    creator?: boolean;
  }[];
  /** Finalizable tabs (null: the list could not be read, so no switch). */
  finalizable: EoiTab[] | null;
  converts: { outline: string | null; full: string | null };
  labels: Record<
    | "list"
    | "edit"
    | "saveDraft"
    | "cancelEdit"
    | "comments"
    | "auditTitle"
    | "close"
    | "finalize"
    | "finalized"
    | "tabs"
    | "deniedTitle"
    | "deniedPage",
    string
  > & { audit: string | null };
}
