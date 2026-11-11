import type {
  ActivityView,
  ClaimView,
  SignOffView,
  UnitTab,
} from "@/shared/claims/unit-record";
import type { ClonePart } from "@/components/dialog/clone-parts";

type Option = { value: string; label: string };

/** One fund on a unit application, as the listing row and the dialog's fund table carry it. */
export interface UnitFund {
  /** `app_fund_id`: the card's link opens the application on this fund. */
  appFundId: string;
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
  /** The card's per-fund tab links (MR 15893): each tab's name, or null without its read right. */
  links: { activities: string | null };
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
  /** The optional grant columns' values by RB key (grant category, grant, payment and holding accounts). */
  grant: Record<string, string>;
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
  | "keyDates"
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
    /** Legacy grantColumn: the grant columns whose RB header is visible, in legacy order. */
    grantColumns: { key: string; header: string }[];
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
export type Header = { label: string; help: string | null };
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

/** The unit record's fund bar (MR 15893): the fund status, the tab's figures, dates, grant fields and counts. */
export interface UnitFundBar {
  /** The fund's read-only summary: status, then the amounts (null when the backend sends none). */
  status: { label: string; value: string };
  /** The tab's figures; `danger` shows a negative value red (legacy). */
  amounts: {
    key: string;
    label: string;
    value: number | null;
    danger: boolean;
  }[];
  /** Claims by / Amendments by: present only when the fund has the date (raw, formatted in the browser). */
  dates: { key: string; label: string; value: string }[];
  /** Grant category, grant, payment and holding accounts: only those whose RB row is visible. */
  grant: { key: string; label: string; value: string }[];
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
}

/** The Activities tab's header (legacy claims-unit-activities: the filter and summary panels, and its own tabs). */
export interface UnitActivitiesView extends UnitFundBar {
  fund: string;
  /** Add Activity's label, or null without the right or in a fund status that allows no edit. */
  add: string | null;
  funds: Option[];
  periods: Option[];
  /** FPCG_ACTIVITY_STATUS, led by legacy's "All" (`""`). */
  statuses: Option[];
  labels: Record<"fund" | "period" | "status", string>;
  tabs: { id: ActivityView; label: string }[];
  empty: string;
  texts: Record<
    "total" | "delete" | "view" | "details" | "roster" | "equipment",
    string
  >;
  /** Why Submit for Approval is missing (legacy submit-needs-zero-unapplied), or null. */
  submitHint: string | null;
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
  | "claim-details"
  | "activity-approvals";
/** The activity-details tab (legacy activity-details): the version, its fields, goals and the sub-tabs it opens. */
export interface UnitActivityView {
  /** Edit's label, or null without the right or in a status that allows no user edit. */
  edit: string | null;
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

/** One benefit or purchase-service line of a position, as the editor holds it (numbers as typed). */
export interface UnitCostDraft {
  key: string;
  /** The saved line's `item_id`; empty for a new line. */
  itemId: string;
  type: "BENEFIT" | "PURCHASE_SERVICE";
  category: string;
  method: string;
  /** Whole percent (50 = 50%). */
  rate: string;
  amount: string;
}
/** The activity form (legacy activityDetails in edit mode), every value as the inputs hold it. */
export interface UnitActivityDraft {
  homeless: string;
  type: string;
  func: string;
  object: string;
  fte: string;
  amount: string;
  salaryAmount: string;
  benefitsAmount: string;
  purchaseAmount: string;
  jobTitle: string;
  jobDescription: string;
  itemization: string;
  justification: string;
  goals: string[];
  payFrequency: string;
  start: string;
  end: string;
  salaryType: string;
  totalSalary: string;
  deductSalary: string;
  hourlyRate: string;
  hoursPerDay: string;
  daysPerYear: string;
  salaryPercent: string;
  deductBenefit: string;
  benefitPercent: string;
  deductService: string;
  servicePercent: string;
  items: UnitCostDraft[];
}
export interface UnitCostCategory {
  code: string;
  name: string;
  type: "BENEFIT" | "PURCHASE_SERVICE";
  method: string;
  methodEditable: boolean;
  /** Whole percent, or null. */
  rate: number | null;
}
/** The Add / Edit Activity form's setup (legacy addNewActivity / editActivity with the drawer's lists). */
export interface UnitActivityEditView {
  fund: string;
  fundName: string;
  /** Empty for a new activity. */
  activity: string;
  version: string;
  draft: UnitActivityDraft;
  /** An amendment's activity: Amendment Justification shows and is required. */
  amending: boolean;
  /** HOMELESS_FIELD_FLAG on the fund: the Homeless radio shows and is required. */
  homeless: boolean;
  types: Option[];
  /** Function codes by activity type; object codes by `type|function`. */
  functions: Record<string, Option[]>;
  objects: Record<string, Option[]>;
  ftes: Option[];
  payFrequencies: Option[];
  salaryTypes: Option[];
  methods: Option[];
  /** The last period for MONTHLY and PAY_PERIOD (FPCG_MAX_MONTHLY_PERIOD / FPCG_MAX_PAY_PERIOD). */
  periods: Record<string, number>;
  categories: UnitCostCategory[];
  goals: Option[];
  labels: Record<string, string>;
  headers: Record<string, string>;
  texts: Record<
    | "title"
    | "create"
    | "update"
    | "cancel"
    | "goals"
    | "addBenefit"
    | "addPurchase"
    | "addCostItem"
    | "edit"
    | "delete"
    | "yes"
    | "no"
    | "general"
    | "position"
    | "salary"
    | "benefit"
    | "purchase"
    | "required",
    string
  >;
}

/** One amendment on the fund (legacy amendmentsListTable row). */
export interface UnitAmendmentRow {
  key: string;
  number: string;
  /** Raw date, formatted in the browser. */
  date: string;
  status: string;
  statusCode: string;
  reason: string;
  reasonCode: string;
  cost: number | null;
  lines: string;
  /** The right and an open (status allows a user edit) amendment: reason, include, add, save. */
  editable: boolean;
  deletable: boolean;
}
/** The Amendments sub-tab (legacy claims-unit-activities › amendments). */
export interface UnitAmendmentsView {
  fund: string;
  statuses: Option[];
  status: string;
  reasons: Option[];
  /** New Amendment: `activity-amendment` edit. */
  canCreate: boolean;
  rows: UnitAmendmentRow[];
  headers: Record<string, string>;
  texts: Record<
    | "status"
    | "reason"
    | "create"
    | "include"
    | "add"
    | "save"
    | "view"
    | "delete"
    | "deleteTitle"
    | "deleteText"
    | "yes"
    | "no"
    | "empty"
    | "total",
    string
  >;
}
/** One activity an amendment changes: current against amended amounts (legacy amendmentLinesTable). */
export interface UnitAmendmentLine {
  key: string;
  activity: string;
  version: string;
  number: string;
  func: string;
  object: string;
  type: string;
  currentSalary: number | null;
  currentBenefits: number | null;
  currentPurchase: number | null;
  currentAmount: number | null;
  amendSalary: number | null;
  amendBenefits: number | null;
  amendPurchase: number | null;
  amendAmount: number | null;
  cost: number | null;
  justification: string;
  itemization: string;
  jobTitle: string;
}
export interface UnitAmendmentLinesView {
  amendment: string;
  editable: boolean;
  deletable: boolean;
  rows: UnitAmendmentLine[];
  headers: Record<string, string>;
}
/** Include Activity's picker: the fund's activities as the amendment sees them. */
export interface UnitIncludeView {
  rows: {
    key: string;
    activity: string;
    version: string;
    number: string;
    func: string;
    object: string;
    type: string;
    salary: number | null;
    benefits: number | null;
    purchase: number | null;
    nonPosition: number | null;
    jobTitle: string;
    itemization: string;
  }[];
  headers: Record<string, string>;
  texts: Record<"title" | "include" | "select", string>;
}

/** Furniture & Equipment on the Fund Summary (legacy furnitureEquipmentSection). */
export interface UnitEquipmentRow {
  key: string;
  description: string;
  /** Raw yyyy-MM-dd, formatted in the browser. */
  date: string;
  price: number | null;
  serial: string;
  location: string;
  condition: string;
  comments: string;
  funds: string[];
  fundNames: string[];
}
/** The Fund Summary's surveys (legacy activitySummary.requirements): each a dynamic form on its requirement. */
export interface UnitRequirementsView {
  /** The fund's status allows a user edit: the person responsible and the survey are editable, Submit is shown. */
  editable: boolean;
  items: {
    key: string;
    form: string;
    /** The dynamic form's slot (the requirement's reference module). */
    slot: string;
    heading: string;
    /** The saved requirement the answers belong to; null until the first Submit. */
    requirementId: string | null;
    name: string;
    email: string;
  }[];
  labels: Record<"name" | "email", string>;
  texts: { submit: string; saved: string; audit: string | null };
}

export interface UnitEquipmentView {
  /** `activity-equipment` edit: Add, Edit, Delete. */
  canEdit: boolean;
  funds: Option[];
  rows: UnitEquipmentRow[];
  total: number;
  headers: Record<string, string>;
  labels: Record<string, string>;
  texts: Record<
    | "heading"
    | "add"
    | "title"
    | "submit"
    | "edit"
    | "delete"
    | "total"
    | "empty"
    | "required",
    string
  >;
}
/** One roster member (legacy rosterTable row). */
export interface UnitRosterRow {
  key: string;
  firstName: string;
  lastName: string;
  teacher: boolean;
  parapro: boolean;
  localFund: boolean;
  primaryFund: string;
  primaryFundName: string;
  primaryTitle: string;
  primaryFile: string;
  secondaryFund: string;
  secondaryFundName: string;
  secondaryTitle: string;
  secondaryFile: string;
  status: string;
  /** `activity-roster` edit and a status that allows a user edit (CLAIM_ROSTER). */
  editable: boolean;
}
export interface UnitRosterView {
  canAdd: boolean;
  funds: Option[];
  rows: UnitRosterRow[];
  headers: Record<string, string>;
  labels: Record<string, string>;
  texts: Record<
    | "approvalTitle"
    | "approvals"
    | "heading"
    | "add"
    | "title"
    | "submit"
    | "edit"
    | "delete"
    | "yes"
    | "no"
    | "deleteTitle"
    | "deleteText"
    | "empty",
    string
  >;
}

/** The Claims tab's header (legacy claims-unit-claims): the fund and status filters, the fund bar, its own tabs. */
export interface UnitClaimsView extends UnitFundBar {
  fund: string;
  funds: Option[];
  /** FPCG_CLAIM_STATUS, led by legacy's "All" (`""`). */
  statuses: Option[];
  labels: Record<"fund" | "status", string>;
  tabs: { id: ClaimView; label: string }[];
  /** Legacy Export on the Claims List: the `claims-export` row. */
  canExport: boolean;
  /** Add Claim's label, or null without `unit-add-claim` edit. */
  add: string | null;
  empty: string;
  texts: Record<
    | "total"
    | "export"
    | "view"
    | "audits"
    | "clone"
    | "delete"
    | "cloneTitle"
    | "cloneMessage"
    | "cancel"
    | "deleteTitle"
    | "deleteMessage"
    | "deleteCancel"
    | "deleteConfirm"
    | "details",
    string
  >;
}
/** The Claims Summary table (legacy claimsSummaryTable): claimed and available by object code, with totals. */
export interface UnitClaimsSummary {
  headers: Record<string, Header>;
  /** The amount columns in legacy's order (`obj_<code>_claimed`, `obj_<code>_balance`, then the total). */
  columns: string[];
  rows: {
    key: string;
    function: string;
    description: string;
    amounts: Record<string, number | null>;
  }[];
  totals: Record<string, number>;
}
/** The Claims List (legacy claimsTable) with each claim's row-menu gates. */
export interface UnitClaimList {
  headers: Record<
    | "number"
    | "date"
    | "status"
    | "paidDate"
    | "po"
    | "period"
    | "amount"
    | "approved"
    | "lines"
    | "rejected"
    | "adjustments",
    Header
  >;
  rows: {
    key: string;
    number: string;
    date: string;
    status: string;
    paidDate: string;
    po: string;
    period: string;
    amount: number | null;
    approved: number | null;
    lines: string;
    rejected: string;
    adjustments: string;
    canClone: boolean;
    canDelete: boolean;
  }[];
}
/** One claim in the side panel (legacy claim drawer): its header fields, lines and their gates. */
export interface UnitClaimView {
  key: string;
  /** An approved or paid claim: its Adjustments show (legacy claims-adjustments tab gate). */
  adjustable: boolean;
  /** The header fields the claim has (legacy shows each only with a value); raw values, formatted by `kind`. */
  fields: {
    key: string;
    label: string;
    value: string;
    kind: "text" | "date" | "money";
  }[];
  canExport: boolean;
  headers: Record<
    | "number"
    | "positionType"
    | "function"
    | "object"
    | "expenditure"
    | "category"
    | "person"
    | "amount"
    | "adjust"
    | "status"
    | "defer"
    | "cohort"
    | "start"
    | "end"
    | "transDate"
    | "transNo"
    | "comments",
    Header
  >;
  lines: {
    key: string;
    number: string;
    positionType: string;
    function: string;
    object: string;
    expenditure: string;
    category: string;
    person: string;
    amount: number | null;
    adjust: number | null;
    status: string;
    defer: boolean;
    cohort: string;
    start: string;
    end: string;
    transDate: string;
    transNo: string;
    comments: string;
    /** The position activity whose claimable amounts the line opens, or null (legacy menu `amounts`). */
    activity: { activity: string; version: string } | null;
    /** Whether the line's Approvals open (legacy menu `approvals`). */
    approvals: boolean;
  }[];
  texts: Record<
    | "title"
    | "audits"
    | "amounts"
    | "approvals"
    | "approvalTitle"
    | "export"
    | "empty"
    | "yes"
    | "no",
    string
  >;
}
/** A claim line as the claim editor holds it until Save Claim (legacy claimLinesADP row): codes and their labels. */
export interface ClaimLineDraft {
  /** The saved line's id, or `new-<n>` for a line added here. */
  key: string;
  lineId: string;
  /** The saved line's number (legacy keeps it on Save Claim); empty for a new line. */
  lineNo: string;
  positionType: string;
  positionTypeLabel: string;
  function: string;
  functionLabel: string;
  object: string;
  objectLabel: string;
  /** POSITION: the planned activity (and its version, fte); otherwise empty. */
  activity: string;
  version: string;
  fte: string;
  /** The expenditure description: the activity's job title for a position, typed otherwise. */
  expenditure: string;
  category: string;
  categoryLabel: string;
  categoryItem: string;
  roster: string;
  rosterLabel: string;
  company: string;
  amount: string;
  defer: "Y" | "N";
  start: string;
  end: string;
  transNo: string;
  transDate: string;
  cohort: string;
  /** Read-only on the line: its status and the reviewer's figures. */
  status: string;
  statusLabel: string;
  adjust: number | null;
  comments: string;
  /** A rejected line brought back into this claim (legacy addRejectedClaimLines). */
  rejected: boolean;
  /** Whether Edit / Delete open on this line (legacy line menu gates). */
  editable: boolean;
}
/** The claim line picker's tree (legacy createHierarchyLookup): type → function → object → activity → categories / people. */
export interface ClaimHierarchy {
  value: string;
  label: string;
  functions: {
    value: string;
    label: string;
    objects: {
      value: string;
      label: string;
      jobs: {
        value: string;
        label: string;
        version: string;
        fte: string;
        categories: { value: string; label: string; item: string }[];
        people: { value: string; label: string }[];
      }[];
    }[];
  }[];
}
/** The claim editor (legacy claim drawer in create / edit): what may change, the picker's data and the line drafts. */
export interface UnitClaimEditView {
  /** Save Claim and the action row (legacy `unit-add-claim` edit). */
  canEdit: boolean;
  /** The claim is open to change: no route yet and a status that allows a user edit (legacy Save / Add gates). */
  open: boolean;
  /** Line Delete (legacy `unit-add-claim` delete). */
  canDeleteLines: boolean;
  period: string;
  periods: Option[];
  cohorts: Option[];
  hierarchy: ClaimHierarchy[];
  /** The fiscal year and its first month, for the transaction date range. */
  fy: string;
  startMonth: string;
  lines: ClaimLineDraft[];
  labels: Record<string, string>;
  texts: Record<
    | "addLine"
    | "addRejected"
    | "save"
    | "lineTitle"
    | "submit"
    | "edit"
    | "delete"
    | "yes"
    | "no"
    | "alreadyExist"
    | "period"
    | "empty",
    string
  >;
}
/** The fund's rejected lines for the claim's period (legacy rejectedClaimLinesDialog). */
export interface UnitRejectedLines {
  lines: ClaimLineDraft[];
}
/** A claim's Adjustments (legacy adjustmentsLogTable). */
export interface UnitAdjustmentsView {
  /** Add Adjustment (legacy: the `unit-claim-adjustment` row). */
  canAdd: boolean;
  headers: Record<
    "number" | "status" | "date" | "by" | "lines" | "comments",
    Header
  >;
  rows: {
    key: string;
    status: string;
    date: string;
    by: string;
    lines: string;
    comments: string;
    canDelete: boolean;
  }[];
  texts: Record<
    "heading" | "add" | "view" | "audits" | "delete" | "empty",
    string
  >;
}
/** An adjustment line as the editor holds it until Save (legacy adjustmentLinesADP row). */
export interface AdjustmentLineDraft {
  key: string;
  adjLineId: string;
  claimLineId: string;
  number: string;
  positionType: string;
  fromFunction: string;
  fromObject: string;
  /** FPCG_ADJ_LINE_TYPE: REJECT (a refund) or RECLASS (new codes). */
  type: string;
  toFunction: string;
  toObject: string;
  justification: string;
  expenditure: number | null;
  refund: string;
  description: string;
  person: string;
  transDate: string;
  transNo: string;
  status: string;
  statusCode: string;
  comments: string;
  editable: boolean;
}
/** One adjustment or a new one (legacy adjustment form, lines and dialogs). */
export interface UnitAdjustmentView {
  /** Empty for a new adjustment. */
  key: string;
  canEdit: boolean;
  canDeleteLines: boolean;
  /** No route yet and a status that allows a user edit (legacy Save / Add gates). */
  open: boolean;
  canExport: boolean;
  status: string;
  refundCheck: string;
  comment: string;
  totalRefund: number | null;
  types: Option[];
  /** The codes a RECLASS line may move to, by position type. */
  codes: {
    type: string;
    functions: { value: string; label: string; objects: Option[] }[];
  }[];
  /** The claim's lines, as new REJECT lines to add. */
  claimLines: AdjustmentLineDraft[];
  lines: AdjustmentLineDraft[];
  lineApprovals: boolean;
  headers: Record<
    | "number"
    | "fromFunction"
    | "fromObject"
    | "status"
    | "type"
    | "toFunction"
    | "toObject"
    | "justification"
    | "expenditure"
    | "refund"
    | "description"
    | "person"
    | "transDate"
    | "transNo"
    | "comments",
    Header
  >;
  labels: Record<string, string>;
  texts: Record<
    | "addLine"
    | "addAll"
    | "save"
    | "export"
    | "lineTitle"
    | "submit"
    | "update"
    | "edit"
    | "delete"
    | "audits"
    | "approvals"
    | "approvalTitle"
    | "empty"
    | "alreadyExist"
    | "sameCodes",
    string
  >;
}
