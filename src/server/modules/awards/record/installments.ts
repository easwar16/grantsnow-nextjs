import "server-only";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import type {
  InstallmentsView,
  MilestonesView,
} from "@/features/modules/awards/record/installments-types";
import { pageOf } from "@/shared/awards/award-record";
import { awardPageLock, awardRecordRead, isDraft } from "../record";
import { costLinesOf, projectsOf } from "./projects";
import { serverFunctions } from "@/server/functions";

const BUNDLE = "award";
const DIALOG_FIELDS = [
  ["title", "installment-title", "Installment Title"],
  ["dueDate", "installment-due-date", "Due Date"],
  ["type", "installment-type", "Installment Type"],
  ["value", "installment-value", "Installment"],
  ["status", "installment-status", "Status"],
] as const;

/**
 * The Installments tab (legacy awards-installments): the award's cost lines and projects for the page's own
 * arithmetic, and its labels. Legacy keeps the installments in the browser tab only, so nothing here writes.
 */
export async function installmentsView(id: string): Promise<InstallmentsView> {
  const [context, rows, format] = await Promise.all([
    awardRecordRead(id, "installments"),
    resources(),
    displayFormat(),
  ]);
  const lock = await awardPageLock(context, "installments");
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    awardId: id,
    // Legacy defect (KB pitfall 10): it ignored view mode, the lock and finalize; changes follow every other tab's rule.
    canEdit:
      isDraft(context) &&
      !lock.locked &&
      context.access.roles.get(pageOf("installments"))?.edit === true,
    decimals: format?.decimals ?? null,
    lines: costLinesOf(context.raw).map((l) => ({
      project_id: l.project_id,
      funding_section_lkp_code: l.funding_section_lkp_code,
      funding_section: l.funding_section,
      cost_category_type_lkp_code: l.cost_category_type_lkp_code,
      cost_category: l.cost_category,
      costing_group_id: l.costing_group_id,
      staff_name: l.staff_name,
      sponsor_contribution: l.sponsor_contribution,
    })),
    projects: projectsOf(context.raw).map((p) => ({
      project_id: Number(p.id),
      project_number: p.number,
      project_name: p.name,
    })),
    fields: Object.fromEntries(
      DIALOG_FIELDS.map(([field, key, fallback]) => [
        field,
        {
          show: serverFunctions.resources.resourceVisible(
            rows,
            BUNDLE,
            "labels",
            key,
          ),
          required: serverFunctions.resources.resourceRequired(
            rows,
            BUNDLE,
            "labels",
            key,
            false,
          ),
          label: t("labels", key, fallback),
          help: serverFunctions.resources.resourceDescription(
            rows,
            BUNDLE,
            "labels",
            key,
          ),
        },
      ]),
    ) as InstallmentsView["fields"],
    texts: {
      funderTotal: t(
        "labels",
        "installment-funder-total",
        "Total Funder Contribution",
      ),
      balance: t("labels", "installment-balance", "Balance"),
      newInstallment: t("button-labels", "installment-new", "New Installment"),
      noBalance: t(
        "helper-texts",
        "installment-no-balance",
        "The funder contribution is fully allocated. Reduce or delete an installment to release funds.",
      ),
      noData: t(
        "helper-texts",
        "installment-no-data",
        "No installments yet. Use New Installment to allocate the funder contribution.",
      ),
      edit: t("button-labels", "installment-edit", "Edit"),
      delete: t("button-labels", "installment-delete", "Delete"),
      costItem: t(
        "table-headers",
        "project-cost-category-item",
        "Cost Category Item",
      ),
      funderContribution: t(
        "table-headers",
        "project-cost-funder-contribution",
        "Funder Contribution",
      ),
      share: t(
        "table-headers",
        "installment-share",
        "Share of Funder Contribution",
      ),
      amount: t("table-headers", "installment-amount", "Installment Amount"),
      remaining: t(
        "table-headers",
        "installment-remaining-balance",
        "Remaining Balance",
      ),
      tableNoData: t("helper-texts", "project-no-data", "No data to display."),
      total: t("labels", "total", "Total"),
      newTitle: t("dialog-titles", "installment-new", "New Installment"),
      editTitle: t("dialog-titles", "installment-edit", "Edit Installment"),
      typeAmount: t("labels", "installment-type-amount", "Amount"),
      typePercent: t("labels", "installment-type-percentage", "Percentage"),
      installmentTotal: t("labels", "installment-total", "Installment Amount"),
      remainingAfter: t(
        "labels",
        "installment-remaining-after",
        "Remaining Balance After Installment",
      ),
      cancel: t("button-labels", "installment-cancel", "Cancel"),
      save: t("button-labels", "installment-save", "Save"),
      deleteTitle: t(
        "dialog-titles",
        "installment-delete",
        "Delete Installment",
      ),
      deleteMessage: t(
        "warning-messages",
        "installment-delete",
        "Deleting this installment releases its amount back to the balance. Are you sure?",
      ),
      deleteNo: t("button-labels", "installment-delete-no", "No"),
      deleteYes: t("button-labels", "installment-delete-yes", "Yes"),
      required: t(
        "error-msg",
        "required-fields",
        "Please fill all the required fields",
      ),
    },
  };
}

/**
 * The Milestones tab (legacy awards-milestones): an always-empty table and Add Milestone, which opens the
 * AWARDS-MILESTONES dynamic form. Legacy's Submit has no action, so nothing is saved.
 */
export async function milestonesView(id: string): Promise<MilestonesView> {
  const [context, rows] = await Promise.all([
    awardRecordRead(id, "milestones"),
    resources(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    awardId: id,
    number: context.award.award_number ?? id,
    canAdd: isDraft(context),
    texts: {
      add: t("labels", "add-milestone", "Add Milestone"),
      description: t("labels", "milestone-desc", "Milestone Description"),
      date: t("labels", "milestone-date", "Milestone Date"),
      amount: t("labels", "milestone-amount", "Milestone Amount"),
      status: t("labels", "status", "Status"),
      noData: t("helper-texts", "no-data", "No data to display."),
      dialogTitle: t("dialog-titles", "add-milestone", "Add Milestone"),
      submit: t("button-labels", "submit", "Submit"),
    },
  };
}
