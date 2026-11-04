import "server-only";
import { z } from "zod";
import omit from "lodash/omit";
import { claims } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import type {
  UnitGoalDialog,
  UnitGoalsView,
} from "@/features/modules/claims/units/types";
import { BUNDLE, label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appSummaryOf } from "./shell";
import { available, FUND_TYPES, statusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const appFundRow = z.object({
  app_fund_id: numberish,
  full_fund_display: optionalText,
  fund_name: optionalText,
  fund_status_code: optionalText,
  fund_type_id: numberish,
  fund_preferences: z.unknown(),
});
export type AppFund = z.infer<typeof appFundRow>;
const linkedRow = z.object({
  activity_number: z.union([z.string(), z.number()]).nullish(),
  activity_status: optionalText,
  itemization_text: optionalText,
  cost: numberish,
});
/** Legacy unitGoalsType: the columns a goal has, and so what its writes may send. */
const goalRow = z.object({
  app_goal_id: numberish,
  app_fund_id: numberish,
  app_id: numberish,
  category: optionalText,
  evaluation_text: optionalText,
  fund_code: optionalText,
  fund_name: optionalText,
  fund_type_id: numberish,
  fy_code: numberish,
  goal_description: optionalText,
  goal_id: numberish,
  goal_number: optionalText,
  linked_activities: z.unknown(),
  org_id: numberish,
  review_comments: optionalText,
  created_by: numberish,
  creation_date: optionalText,
  last_updated_by: numberish,
  last_update_date: optionalText,
});
type GoalRow = z.infer<typeof goalRow>;
const fundGoalRow = z.object({
  goal_id: numberish,
  goal_number: optionalText,
  goal_description: optionalText,
  category: optionalText,
});
export const items = <T extends z.ZodTypeAny>(row: T, raw: unknown) =>
  z.object({ items: z.array(row).nullish() }).parse(raw).items ??
  ([] as z.infer<T>[]);
const linkedOf = (v: unknown) =>
  Array.isArray(v)
    ? v.flatMap((r) => {
        const parsed = linkedRow.safeParse(r);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
/** The list's Activities cell: legacy binds `linked_activities` as text; a list shows its activity numbers. */
const activitiesText = (v: unknown) =>
  Array.isArray(v)
    ? linkedOf(v)
        .map((a) => text(a.activity_number))
        .filter(Boolean)
        .join(", ")
    : text(v);

export const appFundsOf = async (context: UnitRecordContext) =>
  items(
    appFundRow,
    await claims.appFunds({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  );
/** The application's fund, refused when it is not one of its funds. */
export function fundOf(funds: AppFund[], raw: unknown) {
  const id = z.coerce.number().int().positive().safeParse(raw);
  const fund = id.success
    ? funds.find((f) => Number(f.app_fund_id) === id.data)
    : undefined;
  if (!fund)
    throw new AppError(
      "FORBIDDEN",
      "This fund is not on the application.",
      403,
    );
  return fund;
}
export const header = (rows: Resources, key: string, fallback: string) => ({
  label: label(rows, "table-headers", key, fallback),
  help: serverFunctions.resources.resourceDescription(
    rows,
    BUNDLE,
    "table-headers",
    key,
  ),
});
const canManage = (context: UnitRecordContext) =>
  context.access.roles.get("unit-add-goal")?.edit === true;

/**
 * The Goals tab (legacy claims-unit-goals initialize → loadAppFund, loadGoals): the application's funds, the chosen
 * one's goals (the first fund unless `fund` names another), and the fund's status gate.
 */
export async function goalsView(
  id: string,
  rawFund: string | null,
): Promise<UnitGoalsView> {
  const context = await unitRecordRead(id, "goals");
  const [rows, funds, config] = await Promise.all([
    resources(),
    appFundsOf(context),
    statusConfig().catch(() => ({})),
  ]);
  const fund = rawFund ? fundOf(funds, rawFund) : funds[0];
  const list = fund
    ? items(
        goalRow,
        await claims.goals({
          appFundId: Number(fund.app_fund_id),
          orgId: context.user.organizationId,
        }),
      )
    : [];
  return {
    heading: {
      title: label(rows, "header-labels", "goals-summary", "Goals Summary"),
      help: serverFunctions.resources.resourceDescription(
        rows,
        BUNDLE,
        "header-labels",
        "goals-summary",
      ),
    },
    fundLabel: label(rows, "labels", "fund-type", "Fund Type"),
    funds: funds.map((f) => ({
      value: text(f.app_fund_id),
      label: f.full_fund_display ?? f.fund_name ?? "",
    })),
    fund: fund ? text(fund.app_fund_id) : "",
    headers: {
      number: header(rows, "goal-id", "ID"),
      fund: header(rows, "goal-fund", "Fund"),
      activities: header(rows, "goal-activities", "Activities"),
      description: header(rows, "goal-description", "Description"),
      evaluation: header(rows, "goal-evaluation", "Evaluation"),
      reviewerComments: header(
        rows,
        "goal-reviewer-comments",
        "Reviewer Comments",
      ),
    },
    rows: list.map((g, i) => ({
      key: text(g.app_goal_id) || String(i),
      number: g.goal_number ?? "",
      fund: g.fund_name ?? "",
      activities: activitiesText(g.linked_activities),
      description: g.goal_description ?? "",
      evaluation: g.evaluation_text ?? "",
      reviewerComments: g.review_comments ?? "",
      linked: Array.isArray(g.linked_activities)
        ? g.linked_activities.length > 0
        : !!g.linked_activities,
    })),
    empty: label(rows, "helper-texts", "no-data", "No data to display."),
    canManage: canManage(context),
    editable: !!fund && available(config, FUND_TYPES, fund.fund_status_code),
    audit: serverFunctions.resources.resourceVisible(
      rows,
      BUNDLE,
      "button-labels",
      "audit-trail",
    )
      ? label(rows, "button-labels", "audit-trail", "Audit Trail")
      : null,
    texts: {
      addGoal: label(rows, "button-labels", "add-goal", "Add Goal"),
      edit: label(rows, "button-labels", "edit", "Edit"),
      view: label(rows, "button-labels", "view", "View"),
      delete: label(rows, "button-labels", "delete", "Delete"),
    },
  };
}

/** Legacy getFiscalYears: 25 years back to 50 ahead of this one. */
const fiscalYears = (now = new Date()) =>
  Array.from({ length: 76 }, (_, i) => String(now.getFullYear() - 25 + i));
const yearOf = (raw: unknown) => {
  const parsed = z.coerce.number().int().min(1900).max(2200).safeParse(raw);
  return parsed.success ? parsed.data : undefined;
};

/**
 * The add / edit goal dialog (legacy toggleAddGoal / editGoal): the fund type's goals for the fiscal year (legacy
 * loadFundGoals; a new goal starts on the application's year), and for an edit the goal with its linked activities.
 */
export async function goalDialog(
  id: string,
  q: { fund: string | null; goal: string | null; year: string | null },
): Promise<UnitGoalDialog> {
  const context = await unitRecordRead(id, "goals");
  const [rows, funds, config, summary] = await Promise.all([
    resources(),
    appFundsOf(context),
    statusConfig().catch(() => ({})),
    appSummaryOf(context),
  ]);
  const fund = fundOf(funds, q.fund);
  const goal = q.goal ? await goalOf(Number(fund.app_fund_id), q.goal) : null;
  const year =
    yearOf(q.year) ??
    yearOf(goal?.fy_code) ??
    yearOf((summary as { fy_code?: unknown }).fy_code);
  const offered = items(
    fundGoalRow,
    await claims.fundGoals({
      appId: Number(id),
      fundTypeId:
        fund.fund_type_id === null || fund.fund_type_id === undefined
          ? undefined
          : Number(fund.fund_type_id),
      fiscalYear: year,
    }),
  );
  const linked = linkedOf(goal?.linked_activities);
  return {
    title: label(rows, "header-labels", "goals-new-goal", "New Goal"),
    labels: {
      fund: label(rows, "labels", "fund-type", "Fund Type"),
      fiscalYear: label(rows, "labels", "fiscal-year", "Fiscal Year"),
      fundGoal: label(rows, "labels", "fund-goal", "Fund Goal"),
      description: label(rows, "labels", "goal-description", "Description"),
      evaluation: label(rows, "labels", "goals-evaluation", "Evaluation"),
      reviewerComments: label(
        rows,
        "labels",
        "reviewer-comments",
        "Reviewer Comments",
      ),
    },
    texts: {
      add: label(rows, "button-labels", "add-goal", "Add Goal"),
      update: label(rows, "button-labels", "update-goal", "Update Goal"),
      total: label(rows, "labels", "total", "Total"),
    },
    fundName: fund.full_fund_display ?? fund.fund_name ?? "",
    fiscalYears: fiscalYears(),
    // Legacy display_name: a SYSTEM goal shows its description, any other its category.
    goals: offered.map((g) => ({
      value: text(g.goal_id),
      label: `${g.goal_number ?? ""} - ${
        g.category === "SYSTEM"
          ? (g.goal_description ?? "")
          : (g.category ?? "")
      }`,
      number: g.goal_number ?? "",
      description: g.goal_description ?? "",
      category: g.category ?? "",
    })),
    goal: goal
      ? {
          id: text(goal.app_goal_id),
          fiscalYear: text(goal.fy_code),
          goalId: text(goal.goal_id),
          description: goal.goal_description ?? "",
          evaluation: goal.evaluation_text ?? "",
          reviewerComments: goal.review_comments ?? "",
          category: goal.category ?? "",
        }
      : null,
    fiscalYear: year === undefined ? "" : String(year),
    activities: {
      headers: {
        number: header(rows, "activity-number", "Activity Number"),
        status: header(rows, "activity-status", "Status"),
        text: header(rows, "activity-itemization-text", "Itemization Text"),
        cost: header(rows, "activity-cost", "Cost"),
      },
      rows: linked.map((a, i) => ({
        key: text(a.activity_number) || String(i),
        number: text(a.activity_number),
        status: a.activity_status ?? "",
        text: a.itemization_text ?? "",
        cost:
          a.cost === null || a.cost === undefined || a.cost === ""
            ? null
            : Number(a.cost),
      })),
      // Legacy goalActivitiesTotal: the costs summed, a missing cost adding 0.
      total: linked.reduce((sum, a) => sum + (Number(a.cost) || 0), 0),
      empty: label(rows, "helper-texts", "no-data", "No data to display."),
    },
    editable: available(config, FUND_TYPES, fund.fund_status_code),
  };
}

/** One of the fund's goals (getGoalDetails), refused when it belongs to another fund. */
async function goalOf(appFundId: number, raw: unknown): Promise<GoalRow> {
  const id = z.coerce.number().int().positive().safeParse(raw);
  if (!id.success) throw new AppError("BAD_REQUEST", "Invalid goal.", 400);
  const goal = items(
    goalRow,
    await claims.goalDetails({ appGoalId: id.data }),
  )[0];
  if (!goal || Number(goal.app_fund_id) !== appFundId)
    throw new AppError("FORBIDDEN", "This goal is not on the fund.", 403);
  return goal;
}

const saveInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    goal: z.coerce.number().int().positive().optional(),
    fiscalYear: z.coerce.number().int().min(1900).max(2200),
    goalId: z.coerce.number().int().positive(),
    description: z.string().max(4000),
    evaluation: z.string().max(4000),
    reviewerComments: z.string().max(4000),
  })
  .strict();
const deleteInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    goal: z.coerce.number().int().positive(),
  })
  .strict();

/** The write gate: `unit-add-goal` edit, the fund is the application's, and its status allows a user edit. */
async function writable(id: string, rawFund: number) {
  const context = await unitRecordRead(id, "goals");
  const [funds, config] = await Promise.all([
    appFundsOf(context),
    statusConfig(),
  ]);
  const fund = fundOf(funds, rawFund);
  if (
    !canManage(context) ||
    !available(config, FUND_TYPES, fund.fund_status_code)
  )
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change these goals.",
      403,
    );
  return { context, fund };
}

/**
 * WRITES: legacy saveGoal. The goal chosen must be one the fund type offers for the year; its number and category
 * come from that list, and a SYSTEM goal keeps the offered description (legacy makes it read-only). A new goal posts
 * the picked fields; an edit puts the goal as read with them replaced (legacy posts its whole unitGoalsType).
 */
export async function saveGoal(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid goal.", 400);
  const input = parsed.data;
  const { fund } = await writable(id, input.fund);
  const offered = items(
    fundGoalRow,
    await claims.fundGoals({
      appId: Number(id),
      fundTypeId:
        fund.fund_type_id === null || fund.fund_type_id === undefined
          ? undefined
          : Number(fund.fund_type_id),
      fiscalYear: input.fiscalYear,
    }),
  );
  const chosen = offered.find((g) => Number(g.goal_id) === input.goalId);
  if (!chosen)
    throw new AppError("BAD_REQUEST", "Choose a goal from the list.", 400);
  const fields = {
    app_fund_id: Number(fund.app_fund_id),
    fund_type_id:
      fund.fund_type_id === null || fund.fund_type_id === undefined
        ? null
        : Number(fund.fund_type_id),
    fy_code: input.fiscalYear,
    goal_id: input.goalId,
    goal_number: chosen.goal_number ?? null,
    category: chosen.category ?? null,
    goal_description:
      chosen.category === "SYSTEM"
        ? (chosen.goal_description ?? null)
        : input.description,
    evaluation_text: input.evaluation,
    review_comments: input.reviewerComments,
  };
  if (input.goal === undefined) {
    await claims.createGoal({ appFundId: fields.app_fund_id, body: fields });
    return { saved: "created" as const };
  }
  const row = await goalOf(fields.app_fund_id, input.goal);
  // The fiscal year is fixed once a goal exists (legacy: read-only in edit).
  await claims.updateGoal({
    appGoalId: input.goal,
    body: {
      ...omit(row, "linked_activities"),
      ...fields,
      fy_code: row.fy_code,
    },
  });
  return { saved: "updated" as const };
}

/** WRITES: legacy deleteGoal; a goal linked to an activity cannot be deleted (legacy disables Delete). */
export async function deleteGoal(id: string, raw: unknown) {
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid goal.", 400);
  const { fund } = await writable(id, parsed.data.fund);
  const goal = await goalOf(Number(fund.app_fund_id), parsed.data.goal);
  if (
    linkedOf(goal.linked_activities).length > 0 ||
    (!Array.isArray(goal.linked_activities) && !!goal.linked_activities)
  )
    throw new AppError(
      "BAD_REQUEST",
      "A goal linked to an activity cannot be deleted.",
      400,
    );
  await claims.deleteGoal({ appGoalId: parsed.data.goal });
  return { deleted: true as const };
}
