import type {
  ActivityView,
  SignOffView,
  UnitTab,
} from "@/shared/claims/unit-record";
import type { ClonePart } from "@/components/dialog/clone-parts";

type Option = { value: string; label: string };

/** One fund on a unit application, as the listing row and the dialog's fund table carry it. */
export interface UnitFund {
  fundTypeId: string;
  /** `full_fund_display`, or the fund name; the table shows it beside the fund type. */
  name: string;
  start: string;
  end: string;
  amendmentDate: string;
  claimDate: string;
  grantId: string;
  grantName: string;
  paymentAccount: string;
  /** The fund's status code; legacy locks a saved fund's Edit and Delete outside DRFT and REWORK. */
  status: string;
  /** The status as shown (`status_value`). */
  statusName: string;
}

/** One unit application as the listing shows it. */
export interface UnitRow {
  id: string;
  unitId: string;
  unitName: string;
  fiscalYear: string;
  programType: string;
  funds: UnitFund[];
  claims: { completed: string; incomplete: string; inprocess: string };
}

export interface UnitPage {
  rows: UnitRow[];
  total: number | null;
  hasMore: boolean;
}

export type UnitTextKey =
  | "unit"
  | "year"
  | "fund"
  | "statusLabel"
  | "fundStatus"
  | "claimStatus"
  | "completed"
  | "incomplete"
  | "inprocess"
  | "toggle"
  | "create"
  | "edit"
  | "clone"
  | "export"
  | "exportRow"
  | "clear"
  | "empty"
  | "total";

/** RB gates (fail closed) and the dashboard roles legacy reads for the drawer, toolbar and rows. */
export interface UnitListView {
  gates: { unit: boolean; year: boolean; fund: boolean };
  actions: { create: boolean; edit: boolean; clone: boolean; export: boolean };
  texts: Record<UnitTextKey, string>;
  statuses: Option[];
  funds: Option[];
  years: Option[];
  errors: string[];
}

export interface UnitChoiceList {
  options: Option[];
  errors: string[];
}

export type UnitDialogField =
  | "unit"
  | "year"
  | "program"
  | "fundType"
  | "grant"
  | "account"
  | "start"
  | "end"
  | "amendmentDate"
  | "claimDate";

/** The Create / Update Unit dialog: labels, the two RB-gated fields and the program types. */
export interface UnitDialogSetup {
  labels: Record<UnitDialogField, string>;
  /** Grant and Payment Account show and are required by RB (9342); hidden, they are not sent. */
  grant: { show: boolean; required: boolean };
  account: { show: boolean; required: boolean };
  headers: Record<
    | "fund"
    | "start"
    | "end"
    | "amendmentDate"
    | "claimDate"
    | "grant"
    | "account",
    string
  >;
  texts: Record<
    | "createTitle"
    | "updateTitle"
    | "create"
    | "update"
    | "cancel"
    | "addFund"
    | "duplicate"
    | "saved"
    | "empty",
    string
  >;
  programs: Option[];
}

export interface FundTypeOption extends Option {
  code: string;
  name: string;
}
export interface GrantOption extends Option {
  paymentAccount: string;
}
/** The grants of one fund type and year; `autoSelect` picks the first, as legacy's `auto_select: 'Y'`. */
export interface GrantChoices {
  grants: GrantOption[];
  autoSelect: boolean;
}

export interface UnitCloneSetup {
  parts: ClonePart[];
  texts: Record<"title" | "year" | "entire" | "cancel" | "clone", string>;
}

/** The unit record shell (legacy claims-unit-inquiry-info-page): tabs, the Unit / Fiscal Year / Program Type panel. */
export interface UnitShellModel {
  appId: string;
  tabs: { tab: UnitTab; name: string }[];
  panel: { key: string; label: string; value: string }[];
  labels: { list: string; tabs: string };
}
/** A section heading and its RB More Info (sanitised), as legacy's `h1` + rb-help-btn. */
export interface UnitHeading {
  title: string;
  help: string | null;
}
/** One fund of the application with its allocation figures (legacy getFundSummary row). */
export interface UnitFundSummaryRow {
  key: string;
  fund: string;
  status: string;
  original: number | null;
  day20: number | null;
  other: number | null;
  budget: number | null;
  unapplied: number | null;
  pending: number | null;
  /** Raw dates (`yyyy-MM-dd…`), formatted in the browser; the period is start and end. */
  period: [string, string] | null;
  amendmentDate: string;
  claimDate: string;
  /** Legacy's Allocations button: the `unit-fund-allocations` edit right and a status that allows a user edit. */
  allocate: boolean;
}
export type UnitFundColumn =
  | "fund"
  | "status"
  | "original"
  | "day20"
  | "other"
  | "budget"
  | "unapplied"
  | "pending"
  | "period"
  | "amendmentDate"
  | "claimDate"
  | "allocation";
/** A label and its value as text (legacy read-only form fields); dates stay raw for the browser. */
export interface UnitSummaryField {
  key: string;
  /** The app-summary column it edits. */
  column: string;
  label: string;
  value: string;
  date?: boolean;
}
/** The Summary tab (legacy claims-unit-summary), as far as it reads. */
export interface UnitSummaryView {
  fundSummary: UnitHeading & {
    headers: Record<UnitFundColumn, string>;
    rows: UnitFundSummaryRow[];
    /** Legacy summaryTotals: each money column summed; the grand total is the total budget. */
    totals: Record<
      "original" | "day20" | "other" | "budget" | "unapplied" | "pending",
      number
    >;
    totalLabel: string;
    empty: string;
  };
  preparer: UnitHeading & { fields: UnitSummaryField[] };
  cfo: UnitHeading & { fields: UnitSummaryField[] };
  signedOff: UnitHeading & { note: string | null; fields: UnitSummaryField[] };
  /** The Assurance sign-off tab's name (RB page-name.assurance), beside the three lists. */
  assuranceTab: string;
  /** Audit Trail labels (null: RB hidden): the Summary's, and each fund's allocations. */
  audit: string | null;
  allocationAudit: string | null;
  signOffTabs: { view: SignOffView; name: string }[];
  terms: UnitHeading & {
    parts: { key: string; title: string; html: string | null }[];
  };
  /** Legacy's Summary toolbar: Edit / Save / Cancel with the record's `unit-summary-edit` right. */
  edit: {
    allowed: boolean;
    texts: Record<"edit" | "save" | "cancel" | "required", string>;
  };
}
/** One sign-off list (stakeholders, meetings or org documents), read when its tab opens. */
export interface UnitSignOffList {
  headers: { key: string; label: string; help: string | null }[];
  rows: {
    key: string;
    cells: Record<string, string>;
    /** The row's editable values by form field (dates as yyyy-MM-dd). */
    values: Record<string, string>;
    /** A meeting's or document's file: its name opens it. */
    attachment: { id: string; name: string } | null;
  }[];
  /** Columns whose cells are raw dates. */
  dates: string[];
  empty: string;
  /** Add / edit / delete, with the list's `unit-add-*` edit right on an editable summary; else null. */
  manage: {
    add: string;
    save: string;
    title: string;
    fields: {
      key: string;
      label: string;
      kind: "text" | "date" | "select" | "file";
    }[];
    options: { value: string; label: string }[];
    /** Stakeholders are edited in their row; meetings and documents in the dialog. */
    inline: boolean;
  } | null;
  /** The stakeholder exports (`claims-export`), when the list has rows. */
  exports: { list: string; signIn: string } | null;
}

/** One allocation of an application fund (legacy fundAllocationsADP). */
export interface UnitAllocationRow {
  key: string;
  type: string;
  status: string;
  /** Raw `yyyy-MM-dd…`, formatted in the browser. */
  date: string;
  amount: number | null;
}
/** The Fund Allocation dialog (legacy fundAllocationDialog): the fund's allocations and the add / edit form. */
export interface UnitAllocationsView {
  title: string;
  headers: Record<
    "type" | "status" | "date" | "amount",
    { label: string; help: string | null }
  >;
  labels: Record<"type" | "date" | "amount", string>;
  texts: Record<
    "addNew" | "add" | "cancel" | "created" | "updated" | "negative",
    string
  >;
  types: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  rows: UnitAllocationRow[];
  empty: string;
}

/** One application fund as the Unit tabs pick it (legacy appFundsADP). */
export interface UnitFundOption {
  value: string;
  label: string;
}
/** One goal row (legacy unitGoalsType). */
export interface UnitGoalRow {
  key: string;
  number: string;
  fund: string;
  activities: string;
  description: string;
  evaluation: string;
  reviewerComments: string;
  /** Linked to an activity: cannot be deleted (legacy disables Delete). */
  linked: boolean;
}
type Header = { label: string; help: string | null };
/** The Goals tab (legacy claims-unit-goals): one fund's goals and what the user may do with them. */
export interface UnitGoalsView {
  heading: UnitHeading;
  fundLabel: string;
  funds: UnitFundOption[];
  fund: string;
  headers: Record<
    | "number"
    | "fund"
    | "activities"
    | "description"
    | "evaluation"
    | "reviewerComments",
    Header
  >;
  rows: UnitGoalRow[];
  empty: string;
  /** `unit-add-goal` edit: Add Goal and the row actions. */
  canManage: boolean;
  /** The fund's status allows a user edit (legacy isAvailable on CLAIM_FUNDS / AMENDMENT). */
  editable: boolean;
  texts: Record<"addGoal" | "edit" | "view" | "delete", string>;
  /** The fund's goals Audit Trail (null: RB hidden). */
  audit: string | null;
}
/** One goal a fund type offers (legacy fundGoalsType, display_name as legacy builds it). */
export interface UnitFundGoalOption {
  value: string;
  label: string;
  number: string;
  description: string;
  category: string;
}
/** The add / edit goal dialog (legacy addGoalDialog). */
export interface UnitGoalDialog {
  title: string;
  labels: Record<
    | "fund"
    | "fiscalYear"
    | "fundGoal"
    | "description"
    | "evaluation"
    | "reviewerComments",
    string
  >;
  texts: Record<"add" | "update" | "total", string>;
  fundName: string;
  fiscalYears: string[];
  goals: UnitFundGoalOption[];
  /** The goal being edited; null for a new one. */
  goal: {
    id: string;
    fiscalYear: string;
    goalId: string;
    description: string;
    evaluation: string;
    reviewerComments: string;
    category: string;
  } | null;
  fiscalYear: string;
  activities: {
    headers: Record<"number" | "status" | "text" | "cost", Header>;
    rows: {
      key: string;
      number: string;
      status: string;
      text: string;
      cost: number | null;
    }[];
    total: number;
    empty: string;
  };
  editable: boolean;
}

/** The Activities tab's header (legacy claims-unit-activities: the filter and summary panels, and its own tabs). */
export interface UnitActivitiesView {
  fund: string;
  funds: Option[];
  periods: Option[];
  /** FPCG_ACTIVITY_STATUS, led by legacy's "All" (`""`). */
  statuses: Option[];
  labels: Record<"fund" | "period" | "status", string>;
  /** The fund's read-only summary: status, then the amounts (null when the backend sends none). */
  status: { label: string; value: string };
  amounts: { key: string; label: string; value: number | null }[];
  categories: {
    headers: Record<
      "category" | "pending" | "review" | "approved" | "rejected",
      Header
    >;
    rows: {
      key: string;
      category: string;
      pending: string;
      review: string;
      approved: string;
      rejected: string;
    }[];
  };
  tabs: { id: ActivityView; label: string }[];
  empty: string;
  texts: Record<"total" | "delete" | "view" | "details", string>;
}

/** The Fund Summary table (legacy fundSummaryTable): amounts by function, with column totals. */
export interface UnitFundSummary {
  headers: Record<
    | "function"
    | "salaries"
    | "benefits"
    | "services"
    | "supplies"
    | "capital"
    | "total"
    | "description",
    Header
  >;
  rows: {
    key: string;
    function: string;
    salaries: number | null;
    benefits: number | null;
    services: number | null;
    supplies: number | null;
    capital: number | null;
    total: number | null;
    description: string;
  }[];
  totals: Record<
    "salaries" | "benefits" | "services" | "supplies" | "capital" | "total",
    number
  >;
}

export interface UnitActivityRow {
  key: string;
  version: string;
  number: string;
  functionCode: string;
  objectCode: string;
  type: string;
  goals: string;
  amount: number | null;
  jobTitle: string;
  itemization: string;
  fte: string;
  status: string;
  homeless: string;
  amended: string;
  functionDescription: string;
  objectDescription: string;
  /** Legacy: `activity-details` delete, and the row's status allows a user edit (CLAIM_ACTIVITY). */
  deletable: boolean;
}

/** The Activities List table (legacy activityList), with its total. */
export interface UnitActivityList {
  headers: Record<
    | "number"
    | "functionCode"
    | "objectCode"
    | "type"
    | "goals"
    | "amount"
    | "jobTitle"
    | "itemization"
    | "fte"
    | "status"
    | "homeless"
    | "amended"
    | "functionDescription"
    | "objectDescription",
    Header
  >;
  rows: UnitActivityRow[];
  total: number;
}

type Coded = { code: string; name: string };
/** One benefit or purchased-service line of a position (legacy activity_cost_items; rate as a fraction). */
export interface UnitCostItem {
  key: string;
  itemId: string;
  type: "BENEFIT" | "PURCHASE_SERVICE";
  category: Coded;
  method: Coded;
  rate: number | null;
  amount: number | null;
}
/** A position activity's pay, salary, benefit and purchased-service details (percentages as fractions). */
export interface UnitActivityPosition {
  fte: Coded;
  jobTitle: string;
  jobDescription: string;
  payFrequency: Coded;
  start: string;
  end: string;
  salaryType: Coded;
  totalSalary: number | null;
  deductSalary: number | null;
  hourlyRate: number | null;
  hoursPerDay: number | null;
  daysPerYear: number | null;
  salaryPercent: number | null;
  salaryAmount: number | null;
  benefitsAmount: number | null;
  deductBenefit: number | null;
  benefitPercent: number | null;
  purchaseAmount: number | null;
  deductService: number | null;
  servicePercent: number | null;
  items: UnitCostItem[];
}
/** One activity version as the details tab shows it. */
export interface UnitActivity {
  id: string;
  version: string;
  number: string;
  fund: string;
  status: string;
  statusCode: string;
  activeVersion: boolean;
  homeless: string;
  goals: { key: string; number: string; description: string }[];
  type: Coded;
  func: Coded;
  object: Coded;
  amount: number | null;
  position: UnitActivityPosition | null;
  totals: Record<"salary" | "benefits" | "purchase", number | null>;
  itemization: string;
  justification: string;
}
export type UnitActivitySubTab =
  | "general-details"
  | "position-details"
  | "claimable-amount-details"
  | "amendment-history-details"
  | "claim-details";
/** The activity-details tab (legacy activity-details): the version, its fields, goals and the sub-tabs it opens. */
export interface UnitActivityView {
  activity: UnitActivity;
  fundName: string;
  versions: Option[];
  /** Legacy btnMarkAsActive: more than one version, this one not active, and its status editable. */
  canSetActive: boolean;
  /** Legacy HOMELESS_FIELD_FLAG fund preference. */
  homeless: boolean;
  tabs: { id: UnitActivitySubTab; label: string }[];
  labels: Record<string, string>;
  headers: Record<string, Header>;
  helps: Record<string, string | null>;
  empty: string;
  texts: Record<"yes" | "no" | "total" | "markActive" | "back", string>;
}
/** One lazily read sub-tab table: rows of display cells (money as numbers). */
export interface UnitActivityTable {
  columns: { key: string; header: Header; money?: boolean; date?: boolean }[];
  rows: (Record<string, string | number | null> & { key: string })[];
}
/** The claimable-amount sub-tab: three period tables. */
export interface UnitClaimableView {
  tables: {
    key: "salary" | "benefit" | "purchase";
    heading: { label: string; help: string | null };
    headers: Record<"period" | "amount", Header>;
    rows: { key: string; period: string; amount: number | null }[];
    total: number;
  }[];
}
