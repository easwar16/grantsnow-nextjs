/** The Header tab's fields in legacy order (awards-header-start-page.html) and their bundle keys. */
export const HEADER_FIELDS = [
  ["pi", "header-pi-name", "Principal Investigator Name"],
  ["org", "header-org", "Org"],
  ["sponsor", "header-sponsor", "Funder"],
  ["fullTitle", "header-full-title", "Full Title"],
  ["name", "header-award-name", "Award Name"],
  ["number", "header-award-number", "Award Number"],
  ["actualDate", "header-actual-award-date", "Actual Award Date"],
  ["currency", "header-currency", "Currency"],
  ["period", "header-period", "Period"],
  ["billingParty", "billing-party", "Billing Party"],
  ["billingCycle", "billing-cycle", "Billing Cycle"],
  ["billingRule", "billing-distribution-rule", "Billing Distribution Rule"],
  ["revenueRule", "revenue-distribution-rule", "Revenue Distribution Rule"],
  ["assignedTo", "assigned-to", "Assigned To"],
] as const;
export type HeaderField = (typeof HEADER_FIELDS)[number][0];
/** The fields picked from a list; the rest are typed. */
export const HEADER_LISTS = {
  pi: "people",
  org: "orgs",
  sponsor: "sponsors",
  currency: "currencies",
  billingParty: "sponsors",
  assignedTo: "people",
} as const satisfies Partial<Record<HeaderField, string>>;

type Option = { value: string; label: string };
export interface HeaderFieldGate {
  show: boolean;
  required: boolean;
  label: string;
  maxLength?: number;
  /** Never editable here (Award Number; Billing Party without its role). */
  readOnly: boolean;
}
export interface AwardPeriodRow {
  /** The period's proposal: the row's identity in AwardPeriodDetails. */
  key: string;
  start: string;
  end: string;
  amount: string;
  editable: boolean;
}
export interface HeaderView {
  awardId: string;
  number: string;
  fields: Record<HeaderField, HeaderFieldGate>;
  values: Record<HeaderField, string>;
  choices: Record<"people" | "orgs" | "sponsors" | "currencies", Option[]>;
  /** The award's `attribute_N` values, for the attributes panel. */
  attributes: Record<string, string>;
  showAttributes: boolean;
  periods: AwardPeriodRow[];
  /** Edit on the period rows (legacy: a draft, the page's edit right, not locked; not tied to header edit mode). */
  canEditPeriods: boolean;
  periodFields: Record<
    "start" | "end" | "amount",
    { label: string; required: boolean; help?: string | null }
  >;
  proposalRange: { start: string; end: string } | null;
  texts: Record<
    | "required"
    | "updated"
    | "periodsTitle"
    | "periodEditTitle"
    | "periodOutside"
    | "save"
    | "saveHeader"
    | "cancel"
    | "edit"
    | "noPeriods",
    string
  >;
}

/** Legacy H.js: a period outside the proposal's dates warns (it may still be saved). */
export function outsideProposal(
  range: HeaderView["proposalRange"],
  start: string,
  end: string,
) {
  if (!range) return false;
  return (
    (start !== "" && range.start !== "" && start < range.start) ||
    (end !== "" && range.end !== "" && end > range.end)
  );
}
