import "server-only";
import { z } from "zod";
import { claims, lookups } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { AppError } from "@/lib/errors";
import type {
  UnitActivityDraft,
  UnitActivityEditView,
  UnitCostCategory,
  UnitCostDraft,
} from "@/features/modules/claims/units/listing/types";
import {
  itemRateOf,
  lineAmountOf,
  positionAmounts,
  totalSalaryOf,
} from "@/shared/claims/activity-calc";
import { label, lookupOptions, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appFundsOf, fundOf, items, type AppFund } from "./goals";
import {
  activityIds,
  activityOf,
  HEADERS,
  LABELS,
  preferenceOn,
  type ActivityRow,
} from "./activity";
import { canAddActivity, summaryOf, unappliedWarning } from "./activities";
import { amendmentGate } from "./amendments";
import { available, statusConfig, type StatusConfig } from "./status";

const LOOKUPS =
  "FPCG_FTE_CODE,FPCG_PAY_FREQUENCY,FPCG_SALARY_TYPE,FPCG_CALC_METHOD";
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const ITEM_TYPES = ["BENEFIT", "PURCHASE_SERVICE"] as const;
/** `fte_code == 2` is a lump-sum position: its three amounts are typed, with no position details. */
const LUMP_SUM = "2";

const objectRow = z.object({
  object_code: optionalText,
  object_code_descr: optionalText,
});
const functionRow = z.object({
  function_code: optionalText,
  function_code_descr: optionalText,
  object_codes: z.array(objectRow).nullish(),
});
const typeRow = z.object({
  activity_type_code: optionalText,
  activity_type_descr: optionalText,
  function_codes: z.array(functionRow).nullish(),
});
const hierarchyRow = z.object({ activity_types: z.array(typeRow).nullish() });
const categoryRow = z.object({
  active_flag: optionalText,
  calc_method_code: optionalText,
  calc_method_editable_flag: optionalText,
  category_code: optionalText,
  category_name: optionalText,
  category_type_code: optionalText,
  rate: numberish,
});
const goalOption = z.object({
  app_goal_id: numberish,
  goal_number: optionalText,
  goal_description: optionalText,
});

/** Legacy createHierarchyLookup over getFundActivityTypeCodes: types, functions by type, objects by type|function. */
async function hierarchyOf(fund: AppFund) {
  const raw = await claims.activityTypeCodes({
    fundTypeId: Number(fund.fund_type_id),
    grantCategoryId: fund.grant_category_id
      ? Number(fund.grant_category_id)
      : undefined,
  });
  const types = items(hierarchyRow, raw)[0]?.activity_types ?? [];
  const functions: Record<string, { value: string; label: string }[]> = {};
  const objects: Record<string, { value: string; label: string }[]> = {};
  for (const t of types) {
    const type = text(t.activity_type_code);
    functions[type] = (t.function_codes ?? []).map((f) => {
      const func = text(f.function_code);
      objects[`${type}|${func}`] = (f.object_codes ?? []).map((o) => ({
        value: text(o.object_code),
        label: text(o.object_code_descr) || text(o.object_code),
      }));
      return {
        value: func,
        label: text(f.function_code_descr) || func,
      };
    });
  }
  return {
    types: types.map((t) => ({
      value: text(t.activity_type_code),
      label: text(t.activity_type_descr) || text(t.activity_type_code),
    })),
    functions,
    objects,
  };
}

/** Legacy loadCategoryConfig: active categories; the backend's whole-percent rate is kept as is. */
async function categoriesOf(): Promise<UnitCostCategory[]> {
  return items(categoryRow, await claims.categoryConfigs({}))
    .filter(
      (c) =>
        c.active_flag === "Y" &&
        (c.category_type_code === "BENEFIT" ||
          c.category_type_code === "PURCHASE_SERVICE"),
    )
    .map((c) => ({
      code: text(c.category_code),
      name: text(c.category_name) || text(c.category_code),
      type: c.category_type_code as UnitCostCategory["type"],
      method: text(c.calc_method_code),
      methodEditable: c.calc_method_editable_flag === "Y",
      rate:
        c.rate === null || c.rate === undefined || c.rate === ""
          ? null
          : Number(c.rate),
    }));
}

const canEdit = (context: UnitRecordContext) =>
  context.access.roles.get("activity-details")?.edit === true;
/** Legacy Edit: activity-details edit and an activity status that allows a user edit (CLAIM_ACTIVITY). */
export const canEditActivity = (
  context: UnitRecordContext,
  config: StatusConfig,
  activityStatus: string | null | undefined,
) => canEdit(context) && available(config, ["CLAIM_ACTIVITY"], activityStatus);

const EMPTY: UnitActivityDraft = {
  homeless: "",
  type: "",
  func: "",
  object: "",
  fte: "",
  amount: "",
  salaryAmount: "",
  benefitsAmount: "",
  purchaseAmount: "",
  jobTitle: "",
  jobDescription: "",
  itemization: "",
  justification: "",
  goals: [],
  payFrequency: "",
  start: "",
  end: "",
  salaryType: "",
  totalSalary: "",
  deductSalary: "",
  hourlyRate: "",
  hoursPerDay: "",
  daysPerYear: "",
  salaryPercent: "",
  deductBenefit: "",
  benefitPercent: "",
  deductService: "",
  servicePercent: "",
  items: [],
};
const costItem = z.object({
  item_id: numberish,
  category_type_code: optionalText,
  category_code: optionalText,
  calc_method_code: optionalText,
  rate: numberish,
  amount: numberish,
});
const goalRef = z.object({ app_goal_id: numberish });
/** A saved version as the form holds it; percentages stay whole, as the backend returns them. */
function draftOf(row: ActivityRow): UnitActivityDraft {
  const p = row.activity_position_type;
  const list = <T extends z.ZodTypeAny>(schema: T, raw: unknown) =>
    (Array.isArray(raw) ? raw : []).flatMap((r) => {
      const parsed = schema.safeParse(r);
      return parsed.success ? [parsed.data as z.infer<T>] : [];
    });
  return {
    ...EMPTY,
    homeless: text(row.homeless_flag),
    type: text(row.activity_type_code),
    func: text(row.function_code),
    object: text(row.object_code),
    fte: text(p?.fte_code),
    amount: text(row.activity_gen_type?.amount),
    salaryAmount: text(p?.salary_amount),
    benefitsAmount: text(p?.benefits_amount),
    purchaseAmount: text(p?.purchase_svc_amount),
    jobTitle: text(p?.job_title),
    jobDescription: text(p?.job_description),
    itemization: text(row.itemization_text),
    justification: text(row.justification),
    goals: list(goalRef, row.goals).map((g) => text(g.app_goal_id)),
    payFrequency: text(p?.pay_frequency_code),
    start: text(p?.starting_period_no),
    end: text(p?.ending_period_no),
    salaryType: text(p?.salary_type_code),
    totalSalary: text(p?.total_salary),
    deductSalary: text(p?.deduct_salary),
    hourlyRate: text(p?.hourly_rate),
    hoursPerDay: text(p?.hours_per_day),
    daysPerYear: text(p?.days_per_year),
    salaryPercent: text(p?.salary_percent),
    deductBenefit: text(p?.deduct_benefit),
    benefitPercent: text(p?.benefit_percent),
    deductService: text(p?.deduct_service),
    servicePercent: text(p?.service_percent),
    items: list(costItem, p?.activity_cost_items).flatMap(
      (c, i): UnitCostDraft[] =>
        c.category_type_code === "BENEFIT" ||
        c.category_type_code === "PURCHASE_SERVICE"
          ? [
              {
                key: `S${i}`,
                itemId: text(c.item_id),
                type: c.category_type_code,
                category: text(c.category_code),
                method: text(c.calc_method_code),
                rate: text(c.rate),
                amount: text(c.amount),
              },
            ]
          : [],
    ),
  };
}

const keyOf = z
  .object({
    fund: z.coerce.number().int().positive(),
    activity: z.coerce.number().int().positive().optional(),
    version: z.coerce.number().int().positive().optional(),
    // Amendment mode (legacy currentAmendment.amendmentsActive): a reason, and the amendment once it exists.
    amendment: z.coerce.number().int().positive().optional(),
    reason: z.string().min(1).max(40).optional(),
  })
  .strict();
const periodMax = (vars: { var_key?: unknown; var_value?: unknown }[]) => {
  const value = (key: string) =>
    Number(vars.find((v) => v.var_key === key)?.var_value);
  const max = (v: number) => (Number.isInteger(v) && v > 0 && v <= 366 ? v : 0);
  return {
    MONTHLY: max(value("FPCG_MAX_MONTHLY_PERIOD")),
    PAY_PERIOD: max(value("FPCG_MAX_PAY_PERIOD")),
  };
};

/**
 * The Add / Edit Activity form (legacy addNewActivity, editActivity, with loadFundActivityTypeCodes, loadLookups,
 * loadCategoryConfig, loadGoals): the fund's codes and lists, and the version as a draft. Refused without the right
 * or in a status that allows no user edit.
 */
export async function activityEditSetup(
  id: string,
  raw: unknown,
): Promise<UnitActivityEditView> {
  const parsed = keyOf.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid activity.", 400);
  return (await editContext(id, parsed.data)).setup;
}

/** The record, the version (when editing) and the form's setup; refused without the right or status. */
async function editContext(id: string, key: z.infer<typeof keyOf>) {
  if ((key.activity === undefined) !== (key.version === undefined))
    throw new AppError("BAD_REQUEST", "Invalid activity.", 400);
  const context = await unitRecordRead(id, "activities");
  const [funds, config, existing] = await Promise.all([
    appFundsOf(context),
    statusConfig(),
    key.activity
      ? activityOf(
          context,
          activityIds({
            fund: key.fund,
            activity: key.activity,
            version: key.version,
          }),
        )
      : Promise.resolve(undefined),
  ]);
  const fund = fundOf(funds, key.fund);
  const amending = key.reason !== undefined && !existing;
  if (amending)
    // Add Activity in an amendment: the amendment's gate, not the fund's (legacy addAmendmentActivity).
    await amendmentGate(id, key.fund, key.amendment);
  else if (
    existing
      ? !canEditActivity(context, config, existing.row.activity_status_code)
      : !canAddActivity(context, config, fund.fund_status_code)
  )
    throw new AppError(
      "FORBIDDEN",
      "This activity cannot be changed in its current status.",
      403,
    );
  const [rows, hierarchy, codes, categories, goals, vars] = await Promise.all([
    resources(),
    hierarchyOf(fund),
    lookups.codes({ types: LOOKUPS }),
    categoriesOf(),
    claims.goals({
      appFundId: Number(fund.app_fund_id),
      orgId: context.user.organizationId,
    }),
    globalVariables(context.session.token),
  ]);
  const t = (group: string, k: string, fallback: string) =>
    label(rows, group, k, fallback);
  const setup: UnitActivityEditView = {
    fund: text(fund.app_fund_id),
    fundName: fund.full_fund_display ?? fund.fund_name ?? "",
    activity: key.activity ? String(key.activity) : "",
    version: key.version ? String(key.version) : "",
    draft: existing ? draftOf(existing.row) : EMPTY,
    // Opened from the Amendments tab (legacy amendmentsActive), or a version an amendment created.
    amending:
      amending ||
      key.amendment !== undefined ||
      existing?.row.created_from_amendment === "Y",
    homeless: preferenceOn(fund, "HOMELESS_FIELD_FLAG"),
    ...hierarchy,
    ftes: lookupOptions(codes, "FPCG_FTE_CODE"),
    payFrequencies: lookupOptions(codes, "FPCG_PAY_FREQUENCY"),
    salaryTypes: lookupOptions(codes, "FPCG_SALARY_TYPE"),
    methods: lookupOptions(codes, "FPCG_CALC_METHOD"),
    periods: periodMax(vars as { var_key?: unknown; var_value?: unknown }[]),
    categories,
    goals: items(goalOption, goals).map((g) => ({
      value: text(g.app_goal_id),
      label: [g.goal_number, g.goal_description].filter(Boolean).join(" - "),
    })),
    labels: Object.fromEntries([
      ...LABELS.map(([k, fallback]) => [k, t("labels", k, fallback)]),
      ...(
        [
          ["cost-item-category", "Category"],
          ["calculation-method", "Calculation Method"],
          ["calculation-rate", "Rate"],
          ["calculation-amount", "Amount"],
        ] as const
      ).map(([k, fallback]) => [k, t("labels", k, fallback)]),
    ]),
    headers: Object.fromEntries(
      HEADERS.map(([k, fallback]) => [k, t("table-headers", k, fallback)]),
    ),
    texts: {
      title: t("page-name", "activity-details", "Activity Details"),
      create: t("button-labels", "create-activity", "Create"),
      update: t("button-labels", "update-activity", "Update"),
      cancel: t("button-labels", "cancel", "Cancel"),
      goals: t("page-name", "unit-goals", "Goals"),
      addBenefit: t("button-labels", "add-benefit", "Add Benefit"),
      addPurchase: t("button-labels", "add-purchase", "Add Purchase"),
      addCostItem: t("button-labels", "add-cost-item", "Add"),
      edit: t("button-labels", "edit", "Edit"),
      delete: t("button-labels", "delete", "Delete"),
      yes: t("option-keys", "yes", "Yes"),
      no: t("option-keys", "no", "No"),
      general: t("page-name", "general-details", "General Details"),
      position: t("page-name", "position-details", "Position Details"),
      salary: t("header-labels", "salary-information", "Salary Information"),
      benefit: t("header-labels", "benefit-information", "Benefit Information"),
      purchase: t(
        "header-labels",
        "purchase-service-information",
        "Purchase Service Information",
      ),
      required: "Please fill all the required fields!",
    },
  };
  return { context, rows, setup, row: existing?.row };
}

const numberText = z
  .string()
  .max(20)
  .refine((v) => v === "" || Number.isFinite(Number(v)), "Not a number");
const codeText = z.string().max(40);
const draftInput = z
  .object({
    homeless: z.enum(["", "Y", "N"]),
    type: codeText,
    func: codeText,
    object: codeText,
    fte: codeText,
    amount: numberText,
    salaryAmount: numberText,
    benefitsAmount: numberText,
    purchaseAmount: numberText,
    jobTitle: z.string().max(240),
    jobDescription: z.string().max(4000),
    itemization: z.string().max(4000),
    justification: z.string().max(4000),
    goals: z.array(z.string().regex(/^\d{1,15}$/)).max(200),
    payFrequency: codeText,
    start: numberText,
    end: numberText,
    salaryType: codeText,
    totalSalary: numberText,
    deductSalary: numberText,
    hourlyRate: numberText,
    hoursPerDay: numberText,
    daysPerYear: numberText,
    salaryPercent: numberText,
    deductBenefit: numberText,
    benefitPercent: numberText,
    deductService: numberText,
    servicePercent: numberText,
    items: z
      .array(
        z
          .object({
            key: z.string().max(40),
            itemId: z.string().regex(/^\d{0,15}$/),
            type: z.enum(ITEM_TYPES),
            category: codeText,
            method: codeText,
            rate: numberText,
            amount: numberText,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
const saveInput = keyOf.extend({ draft: draftInput }).strict();
const num = (v: string) => (v === "" ? null : Number(v));

/**
 * WRITES: creates or updates one activity version (legacy saveActivity: postActivities / putClaimsActivity). The
 * right and the status are checked again; codes, goals and categories must be the fund's own; the derived amounts
 * are computed here, not taken from the browser. Legacy's "at least one goal" check also covers a new activity.
 */
export async function saveActivity(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid activity.", 400);
  const { draft: d, ...key } = parsed.data;
  const { context, rows, setup, row } = await editContext(id, key);
  const problem = draftProblem(setup, d);
  if (problem) throw new AppError("BAD_REQUEST", problem, 400);
  const body = payloadOf(setup, d, row, key.reason);
  const appFundId = Number(setup.fund);
  const before = await summaryOf(context, appFundId);
  const result = key.activity
    ? await claims.updateActivity({
        activityId: key.activity,
        versionId: key.version!,
        body,
      })
    : await claims.createActivity({
        appFundId,
        amendmentId: key.amendment,
        body,
      });
  const saved = z
    .object({
      items: z
        .array(
          z.object({
            activity_id: numberish,
            amend_version_id: numberish,
            amendment_id: numberish,
          }),
        )
        .nullish(),
      response: optionalText,
      info_message: optionalText,
    })
    .safeParse(result);
  const first = saved.success ? saved.data.items?.[0] : undefined;
  const after = await summaryOf(context, appFundId);
  return {
    activity:
      text(first?.activity_id) || (key.activity ? String(key.activity) : ""),
    version:
      text(first?.amend_version_id) || (key.version ? String(key.version) : ""),
    // The first activity added to a new amendment mints it (legacy saveActivity).
    amendment:
      text(first?.amendment_id) || (key.amendment ? String(key.amendment) : ""),
    info:
      saved.success && saved.data.info_message
        ? {
            summary: saved.data.response ?? "",
            message: saved.data.info_message,
          }
        : null,
    warning: unappliedWarning(
      rows,
      before?.unapplied_balance,
      after?.unapplied_balance,
    ),
  };
}

/** The checks legacy's vgActivityDetails makes (required fields by type), plus the fund's own codes and goals. */
function draftProblem(
  setup: UnitActivityEditView,
  d: z.infer<typeof draftInput>,
): string | null {
  const required = setup.texts.required;
  const has = (v: string) => v.trim() !== "";
  const position = d.type === "POSITION";
  const lump = position && d.fte === LUMP_SUM;
  const inList = (list: { value: string }[] | undefined, v: string) =>
    (list ?? []).some((o) => o.value === v);
  if (!inList(setup.types, d.type)) return required;
  if (!inList(setup.functions[d.type], d.func)) return required;
  if (
    !position &&
    d.type !== "TUITION" &&
    !inList(setup.objects[`${d.type}|${d.func}`], d.object)
  )
    return required;
  if (setup.homeless && !has(d.homeless)) return required;
  if (!has(d.itemization)) return required;
  if (setup.amending && !has(d.justification)) return required;
  if (d.goals.length === 0) return "Please add at least one goal.";
  if (d.goals.some((g) => !inList(setup.goals, g))) return required;
  if (!position)
    return d.type !== "TUITION" && !has(d.amount) ? required : null;
  if (!inList(setup.ftes, d.fte) || !has(d.jobTitle) || !has(d.jobDescription))
    return required;
  if (lump) return has(d.salaryAmount) ? null : required;
  // The periods show (and are required) once a pay frequency is chosen.
  if (has(d.payFrequency)) {
    if (!inList(setup.payFrequencies, d.payFrequency)) return required;
    const max = setup.periods[d.payFrequency] ?? 0;
    const period = (v: string) =>
      Number.isInteger(Number(v)) &&
      Number(v) >= 1 &&
      (!max || Number(v) <= max);
    if (!period(d.start) || !period(d.end) || Number(d.start) > Number(d.end))
      return required;
  }
  if (!inList(setup.salaryTypes, d.salaryType) || !has(d.salaryPercent))
    return required;
  if (d.salaryType === "EXEMPT" && !has(d.totalSalary)) return required;
  if (
    d.salaryType === "HOURLY" &&
    (!has(d.hourlyRate) || !has(d.hoursPerDay) || !has(d.daysPerYear))
  )
    return required;
  for (const item of d.items) {
    const category = setup.categories.find(
      (c) => c.code === item.category && c.type === item.type,
    );
    if (!category || !inList(setup.methods, item.method))
      return "Select a category and a calculation method.";
  }
  const total = positionAmounts(figuresOf(d)).totalSalary;
  for (const type of ITEM_TYPES) {
    const percent = type === "BENEFIT" ? d.benefitPercent : d.servicePercent;
    if (d.items.some((i) => i.type === type) && total && !has(percent))
      return required;
  }
  return null;
}

function figuresOf(d: z.infer<typeof draftInput>) {
  const base = baseFigures(d);
  const total = totalSalaryOf(base);
  return {
    ...base,
    items: d.items.map((i) => ({
      type: i.type,
      amount: lineAmountOf(total, i.method, num(i.rate), num(i.amount)),
    })),
  };
}
function baseFigures(d: z.infer<typeof draftInput>) {
  return {
    salaryType: d.salaryType,
    totalSalary: num(d.totalSalary),
    deductSalary: num(d.deductSalary),
    hourlyRate: num(d.hourlyRate),
    hoursPerDay: num(d.hoursPerDay),
    daysPerYear: num(d.daysPerYear),
    salaryPercent: num(d.salaryPercent),
    deductBenefit: num(d.deductBenefit),
    benefitPercent: num(d.benefitPercent),
    deductService: num(d.deductService),
    servicePercent: num(d.servicePercent),
    items: d.items.map((i) => ({ type: i.type, amount: num(i.amount) })),
  };
}

/**
 * Legacy saveActivity's body, picked field by field: the common fields, then a position (with its cost lines, rates
 * and percentages whole) or the general amount. An update keeps the version's reviewer comments, payee and origin.
 */
function payloadOf(
  setup: UnitActivityEditView,
  d: z.infer<typeof draftInput>,
  row: ActivityRow | undefined,
  reason?: string,
) {
  const position = d.type === "POSITION";
  const common = {
    activity_type_code: d.type,
    homeless_flag: setup.homeless ? d.homeless : (row?.homeless_flag ?? "N"),
    function_code: d.func,
    object_code: position ? "100" : d.type === "TUITION" ? "200" : d.object,
    itemization_text: d.itemization,
    justification: setup.amending
      ? d.justification
      : row
        ? d.justification || row.justification || null
        : null,
    reviewer_comments: row?.reviewer_comments ?? null,
    paid_to_person_id: row?.paid_to_person_id ?? null,
    created_from_amendment: row?.created_from_amendment ?? (reason ? "Y" : "N"),
    ...(reason && !row ? { reason } : {}),
    goals: d.goals.map(Number),
  };
  if (!position)
    return { ...common, activity_gen_type: { amount: num(d.amount) } };
  if (d.fte === LUMP_SUM)
    return {
      ...common,
      activity_position_type: {
        fte_code: d.fte,
        job_title: d.jobTitle,
        job_description: d.jobDescription,
        salary_amount: num(d.salaryAmount),
        benefits_amount: num(d.benefitsAmount),
        purchase_svc_amount: num(d.purchaseAmount),
        activity_cost_items: [],
      },
    };
  const figures = figuresOf(d);
  const amounts = positionAmounts(figures);
  const hourly = d.salaryType === "HOURLY";
  return {
    ...common,
    activity_position_type: {
      fte_code: d.fte,
      job_title: d.jobTitle,
      job_description: d.jobDescription,
      pay_frequency_code: d.payFrequency,
      starting_period_no: num(d.start),
      ending_period_no: num(d.end),
      salary_type_code: d.salaryType,
      total_salary: amounts.totalSalary,
      deduct_salary: num(d.deductSalary),
      hourly_rate: hourly ? num(d.hourlyRate) : null,
      hours_per_day: hourly ? num(d.hoursPerDay) : null,
      days_per_year: hourly ? num(d.daysPerYear) : null,
      salary_percent: num(d.salaryPercent),
      deduct_benefit: num(d.deductBenefit),
      benefit_percent: num(d.benefitPercent),
      benefits_amount: amounts.benefits,
      deduct_service: num(d.deductService),
      service_percent: num(d.servicePercent),
      purchase_svc_amount: amounts.purchase,
      activity_cost_items: d.items.map((i) => {
        const category = setup.categories.find((c) => c.code === i.category)!;
        const flat = i.method === "FLAT_AMOUNT";
        const amount = lineAmountOf(
          amounts.totalSalary,
          i.method,
          num(i.rate),
          num(i.amount),
        );
        return {
          ...(i.itemId ? { item_id: Number(i.itemId) } : {}),
          category_type_code: i.type,
          category_code: i.category,
          category_code_descr: category.name,
          calc_method_code: i.method,
          calc_method_code_descr:
            setup.methods.find((m) => m.value === i.method)?.label ?? "",
          rate: flat ? itemRateOf(amounts.totalSalary, amount) : num(i.rate),
          amount,
        };
      }),
    },
  };
}
