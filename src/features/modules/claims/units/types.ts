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
