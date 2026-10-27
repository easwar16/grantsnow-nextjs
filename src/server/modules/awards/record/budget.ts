import "server-only";
import { z } from "zod";
import { awards } from "@/server/oracle/api";
import {
  label,
  resourceDescription,
  resourceRequired,
  resourceVisible,
  resources,
} from "@/server/platform/configuration/resources";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { AppError } from "@/lib/errors";
import { pageOf } from "@/shared/awards/award-record";
import type { BudgetRow } from "@/features/modules/awards/record/budget-model";
import { awardPageLock, awardRecordRead, isDraft } from "../record";

const BUNDLE = "award";
const PAGE = pageOf("budget-periods");
const ADD = "awards-budget-periods-add-award-budget-period";
const amount = z.coerce.number().finite().nullish().catch(null);
const rowSchema = z.object({
  budget_period: z.union([z.string(), z.number()]).nullish(),
  budget_period_type: z.string().nullish(),
  cost_start_date: z.string().nullish(),
  cost_end_date: z.string().nullish(),
  total_direct_cost: amount,
  total_indirect_cost: amount,
  sponsor_contribution: amount,
  instituition_contribution: amount,
  total_cost: amount,
  erp_budget_period_id: z.union([z.string(), z.number()]).nullish(),
  is_editable: z.union([z.number(), z.string(), z.boolean()]).nullish(),
});
/** Legacy AddBudgetLineButtonActionChain: a new period's type is the global CALENDAR_TYPE. */
const calendarType = (
  globals: { var_key: string; var_value?: string | number | null }[],
) => str(globals.find((g) => g.var_key === "CALENDAR_TYPE")?.var_value);
const truthy = (v: unknown) => v === true || Number(v) === 1 || v === "Y";
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** The award's periods (AwardDetails `Award Budget Periods`), amounts defaulting to 0 as legacy processAwardsData. */
function budgetRows(raw: Record<string, unknown>): BudgetRow[] {
  const rows = z
    .array(rowSchema.nullable())
    .catch([])
    .parse(raw["Award Budget Periods"] ?? []);
  return rows.flatMap((r) =>
    r
      ? [
          {
            key: str(r.budget_period),
            type: str(r.budget_period_type),
            start: str(r.cost_start_date).slice(0, 10),
            end: str(r.cost_end_date).slice(0, 10),
            direct: r.total_direct_cost ?? 0,
            indirect: r.total_indirect_cost ?? 0,
            sponsor: r.sponsor_contribution ?? 0,
            institution: r.instituition_contribution ?? 0,
            total: r.total_cost ?? 0,
            erpId: str(r.erp_budget_period_id),
            editable: truthy(r.is_editable),
          },
        ]
      : [],
  );
}

/** Legacy's gates: Add needs page read, the Add button's role, a draft, the award editable, edit access and no lock. */
async function budgetGates(id: string) {
  const context = await awardRecordRead(id, "budget-periods");
  const lock = await awardPageLock(context, "budget-periods");
  const role = (key: string) => context.access.roles.get(key);
  const edit = role(PAGE)?.edit === true && isDraft(context) && !lock.locked;
  return {
    context,
    canAdd:
      edit && role(ADD)?.read === true && truthy(context.award.is_editable),
    canEdit: edit,
  };
}

export async function budgetView(id: string) {
  const [{ context, canAdd, canEdit }, rows, globals] = await Promise.all([
    budgetGates(id),
    resources(),
    globalVariables(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, BUNDLE, group, key, fallback);
  const field = (key: string, fallback: string) => ({
    label: t("labels", key, fallback),
    show: resourceVisible(rows, BUNDLE, "labels", key),
    required: resourceRequired(rows, BUNDLE, "labels", key, false),
    help: resourceDescription(rows, BUNDLE, "labels", key),
  });
  return {
    awardId: id,
    rows: budgetRows(context.raw),
    canAdd,
    canEdit,
    calendarType: calendarType(globals),
    award: {
      start: str(context.award.award_start_date).slice(0, 10),
      end: str(context.award.award_end_date).slice(0, 10),
    },
    columns: {
      start: t("labels", "start-date", "Start date"),
      end: t("labels", "end-date", "End date"),
      // Legacy's key is misspelt in the bundle.
      type: t("labels", "bidget-period-type", "Budget Period Type"),
      direct: t("labels", "total_direct_cost", "Total Direct Cost"),
      indirect: t("labels", "total_indirect_cost", "Total Indirect Cost"),
      sponsor: t("labels", "sponsor_contribution", "Funder Contribution"),
      institution: t(
        "labels",
        "instituition-contribuition",
        "Institution Contribution",
      ),
      total: t("labels", "total_cost", "Total Cost"),
      footer: t("labels", "total", "Total"),
    },
    fields: {
      type: field("period-type", "Period Type"),
      start: field("cost_period_startdate", "Cost Period Start Date"),
      end: field("cost_period_enddate", "Cost Period End Date"),
      direct: field("budget-period-total_direct_cost", "Total Direct Cost"),
      indirect: field(
        "budget-period-total_indirect_cost",
        "Total Indirect Cost",
      ),
      sponsor: field(
        "budget-period-sponsor_contribution",
        "Funder Contribution",
      ),
      institution: field(
        "budget-period-institution_contribution",
        "Institution Contribution",
      ),
      total: field("budget-period-total_cost", "Total Cost"),
    },
    texts: {
      add: t("button-labels", "budget-period-add", "Add"),
      edit: t("button-labels", "budget-period-edit", "Edit"),
      save: t("button-labels", "budget-period-save", "Save"),
      cancel: t("button-labels", "cancel", "Cancel"),
      title: t("dialog-titles", "award-budget-periods", "Award Budget Periods"),
      required: t(
        "error-msg",
        "required-fields",
        "Please fill all the required fields",
      ),
      // Legacy shows this literal; there is no bundle key.
      saved: "Budget Period Has been Saved Successfully",
      noData: t("helper-texts", "no-data", "No data to display."),
    },
  };
}
export type BudgetView = Awaited<ReturnType<typeof budgetView>>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite();
const budgetInput = z
  .object({
    key: z.string().max(60),
    start: day,
    end: day,
    direct: money.min(0),
    indirect: money.min(0),
    sponsor: money.min(0),
    // Legacy allows a negative institution share (the funder may exceed the total).
    institution: money,
    total: money.min(0),
  })
  .strict();
/**
 * WRITES: one budget period (legacy SaveBudgetPeriodButtonActionChain), an explicit UPPER_SNAKE pick. Editing needs
 * an existing editable period; adding (key "") needs the Add gates. Dates stay inside the award's dates.
 */
export async function saveBudgetPeriod(id: string, raw: unknown) {
  const input = budgetInput.parse(raw);
  const { context, canAdd, canEdit } = await budgetGates(id);
  const adding = input.key === "";
  const existing = budgetRows(context.raw).find((r) => r.key === input.key);
  if (adding ? !canAdd : !canEdit || !existing?.editable)
    throw new AppError(
      "FORBIDDEN",
      "This budget period cannot be changed.",
      403,
    );
  const awardStart = str(context.award.award_start_date).slice(0, 10),
    awardEnd = str(context.award.award_end_date).slice(0, 10);
  if (
    input.end < input.start ||
    (awardStart && input.start < awardStart) ||
    (awardEnd && input.end > awardEnd)
  )
    throw new AppError(
      "BAD_REQUEST",
      "The period's dates must be within the award's dates.",
      400,
    );
  if (input.institution > input.total)
    throw new AppError(
      "BAD_REQUEST",
      "The institution contribution cannot exceed the total cost.",
      400,
    );
  const globals = await globalVariables();
  await awards.saveBudgetPeriod({
    body: {
      BUDGET_PERIOD: input.key,
      AWARD_ID: context.award.award_id,
      BUDGET_PERIOD_TYPE: adding ? calendarType(globals) : existing!.type,
      COST_START_DATE: input.start,
      COST_END_DATE: input.end,
      TOTAL_DIRECT_COST: input.direct,
      TOTAL_INDIRECT_COST: input.indirect,
      TOTAL_COST: input.total,
      SPONSOR_CONTRIBUTION: input.sponsor,
      INSTITUITION_CONTRIBUTION: input.institution,
      ERP_BUDGET_PERIOD_ID: adding ? "" : existing!.erpId,
    },
  });
  return { saved: true };
}
