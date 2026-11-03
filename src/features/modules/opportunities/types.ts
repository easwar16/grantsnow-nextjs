import type { OpportunityQuery } from "./schemas";
export interface OpportunityRow {
  id: string;
  title: string;
  url?: string;
  status: string;
  funders?: string[];
  coFunders?: string[];
  site?: string;
  logo?: string;
  /** The card's meta cells that have a value and pass their RB gate; money as the raw number, shared-on as ISO. */
  meta?: Partial<Record<MetaKey, string>>;
  currency?: string;
  published?: string;
  opening?: string;
  /** The finder's comma-separated sponsor deadline list (else the closing date); the card formats each date. */
  closing?: string;
  applications?: number;
  proposals?: number;
  outlines?: number;
  summary?: string;
  bookmarked: boolean;
  isNew?: boolean;
  closingSoon?: boolean;
  /** Who else bookmarked it, for the bookmark tooltip. */
  otherBookmarks?: string;
  /** Sanitised notes HTML. */
  notes?: string;
  /** The Shared tab's one share comment (8516). */
  shared?: { by?: string; at?: string; comment?: string };
  /** The row's create flags (`create_*` = 'Y'); the card adds its gates and the status rule. */
  canApply?: boolean;
  canConvert?: boolean;
  canConvertToProposal?: boolean;
  /** Raw closing_date, for the deadline warning (the `closing` cell may show the deadline instead). */
  closingAt?: string;
}
export const opportunityDateKeys = [
  "publication-date",
  "opening-date",
  "closing-date",
] as const;
/** The card's meta cells in the original's order (GN-Angular finder.ts META). */
export const META_KEYS = [
  "funding-type",
  "total-fund",
  "fund-ceiling",
  "programme",
  "call",
  "type-of-mga",
  "award-floor",
  "assistance-listing",
  "funding-opportunity-no",
  "cost-sharing",
  "funder-type",
  "shared-by",
  "shared-on",
] as const;
export type MetaKey = (typeof META_KEYS)[number];
export type OpportunityLabelKey =
  | (typeof opportunityDateKeys)[number]
  | "funding-type"
  | "total-fund"
  | "aoi-count"
  | "proposals-count"
  | "outline-proposals-count"
  | "not-available"
  | "check-website"
  | "more-info"
  | "new"
  | "closing-soon"
  | "share"
  | "share-comments"
  | "notes"
  | "apply"
  | "convert"
  | "convert-to-proposal"
  | "notes-title"
  | "save"
  | "close"
  | "cancel"
  | "continue"
  | "deadline-title"
  | "deadline-message"
  | "comments-title"
  | "comment-singular"
  | "comment-plural"
  | "no-share-comments";
/** Which card controls the opener shows: its RB rows and dashboard access (GN-Angular CardView). */
export interface CardActions {
  /** The RB bundle the dialogs read and that the server re-checks gates against. */
  opener: "finder" | "dashboard";
  pills: { new: boolean; closingSoon: boolean };
  moreInfo: boolean;
  status: boolean;
  share: boolean;
  notes: boolean;
  notesEdit: boolean;
  /** The finder's Shared tab only. */
  comments: boolean;
  apply: boolean;
  convert: boolean;
  convertToProposal: boolean;
  /** OPP_DEADLINE_WARNING_DAYS when OPP_DEADLINE_WARNING_ENABLED is 'Y', else null. */
  deadlineWarningDays: number | null;
}
/** Labels from the opener's RB bundle and the date columns its gates show (one card, D32). */
export interface OpportunityCardModel {
  labels: Record<OpportunityLabelKey, string>;
  dates: (typeof opportunityDateKeys)[number][];
  /** The meta cells this card shows, in order, with their labels; money cells are highlighted. */
  meta: { key: MetaKey; label: string; kind: "text" | "money" | "date" }[];
  actions: CardActions;
}
export interface OpportunityPage {
  card: OpportunityCardModel;
  rows: OpportunityRow[];
  total: number;
  hasMore: boolean;
  query: OpportunityQuery;
  /** The access read behind the count cells failed, so they are hidden; the UI says so. */
  countsUnavailable?: true;
}
