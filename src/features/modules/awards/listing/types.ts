import type { StatusTone } from "@/components/ui/status-badge";
import type { AwardActionGates } from "./actions";

/** One award as the list shows it; a field is absent when empty or when its RB gate hides it. */
export interface AwardListRow {
  id: string;
  number?: string;
  status?: string;
  tone?: StatusTone;
  title?: string;
  proposal?: string;
  start?: string;
  end?: string;
  awarded?: string;
  created?: string;
  updated?: string;
  assignedTo?: string;
  funder?: string;
  billingParty?: string;
  org?: string;
  pi?: string;
  amount?: string;
}

export interface AwardListPage {
  rows: AwardListRow[];
  /** AwardHeader's `total_count`; null when the reply has none. */
  total: number | null;
  hasMore: boolean;
}

export interface AwardChoice {
  value: string;
  label: string;
}

/** RB `is_visible` gates (fail closed) for the drawer, the toolbar and the row. */
export interface AwardListGates {
  number: boolean;
  name: boolean;
  proposal: boolean;
  org: boolean;
  assignedTo: boolean;
  funder: boolean;
  billingParty: boolean;
  dateSort: boolean;
  start: boolean;
  end: boolean;
  pi: boolean;
  awarded: boolean;
  created: boolean;
  updated: boolean;
  amount: boolean;
  view: boolean;
  cardView: boolean;
}

export type AwardListTextKey =
  | "number"
  | "name"
  | "proposal"
  | "org"
  | "assignedTo"
  | "funder"
  | "billingParty"
  | "dateSort"
  | "start"
  | "end"
  | "pi"
  | "awarded"
  | "created"
  | "updated"
  | "amount"
  | "clear"
  | "toggle"
  | "view"
  | "listView"
  | "cardView"
  | "empty"
  | "total"
  | "createAward"
  | "advanced"
  | "link"
  | "clone";

/** What the page renders with: gates, bundle texts, the status tabs and the date sorts (all held reference data). */
export interface AwardListView {
  gates: AwardListGates;
  actions: AwardActionGates;
  texts: Record<AwardListTextKey, string>;
  statuses: AwardChoice[];
  sorts: AwardChoice[];
  /** Choices that failed to load and should be reported. */
  errors: string[];
}

/** One of the drawer's slower choice lists (`orgs`, `people`, `parties`), read after the page shows (legacy loads them
 * beside the list, not before it); a failed read is empty and reported. */
export interface AwardChoiceList {
  options: AwardChoice[];
  errors: string[];
}
