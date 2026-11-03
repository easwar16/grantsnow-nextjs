import type { InstallmentLine, InstallmentProject } from "./installments-model";

export interface InstallmentField {
  show: boolean;
  required: boolean;
  label: string;
  help: string | null;
}
export interface InstallmentsView {
  awardId: string;
  /** A draft whose Installments page is editable and not locked or finalized. */
  canEdit: boolean;
  decimals: number | null;
  lines: InstallmentLine[];
  projects: InstallmentProject[];
  fields: Record<
    "title" | "dueDate" | "type" | "value" | "status",
    InstallmentField
  >;
  texts: Record<
    | "funderTotal"
    | "balance"
    | "newInstallment"
    | "noBalance"
    | "noData"
    | "edit"
    | "delete"
    | "costItem"
    | "funderContribution"
    | "share"
    | "amount"
    | "remaining"
    | "tableNoData"
    | "total"
    | "newTitle"
    | "editTitle"
    | "typeAmount"
    | "typePercent"
    | "installmentTotal"
    | "remainingAfter"
    | "cancel"
    | "save"
    | "deleteTitle"
    | "deleteMessage"
    | "deleteNo"
    | "deleteYes"
    | "required",
    string
  >;
}
export interface MilestonesView {
  awardId: string;
  number: string;
  /** Legacy: Add Milestone is enabled only for an editable (draft) award. */
  canAdd: boolean;
  texts: Record<
    | "add"
    | "description"
    | "date"
    | "amount"
    | "status"
    | "noData"
    | "dialogTitle"
    | "submit",
    string
  >;
}
