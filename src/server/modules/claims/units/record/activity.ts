import "server-only";
import { z } from "zod";
import omit from "lodash/omit";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { AppError } from "@/lib/errors";
import type {
  UnitActivity,
  UnitActivityTable,
  UnitActivityView,
  UnitClaimableView,
  UnitCostItem,
} from "@/features/modules/claims/units/types";
import { BUNDLE, label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appFundsOf, fundOf, header, items, type AppFund } from "./goals";
import { available, statusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const amount = (v: unknown) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
/** Legacy loadActivityDetails: percentages arrive ×100 and are held as fractions. */
const fraction = (v: unknown) => {
  const n = amount(v);
  return n === null ? null : n / 100;
};

const costItemRow = z.object({
  item_id: numberish,
  category_type_code: optionalText,
  category_code: optionalText,
  category_code_descr: optionalText,
  calc_method_code: optionalText,
  calc_method_code_descr: optionalText,
  rate: numberish,
  amount: numberish,
});
const positionRow = z.object({
  fte_code: numberish,
  fte_code_descr: optionalText,
  job_title: optionalText,
  job_description: optionalText,
  pay_frequency_code: optionalText,
  pay_frequency_code_descr: optionalText,
  starting_period_no: numberish,
  ending_period_no: numberish,
  salary_type_code: optionalText,
  salary_type_code_descr: optionalText,
  total_salary: numberish,
  deduct_salary: numberish,
  hourly_rate: numberish,
  hours_per_day: numberish,
  days_per_year: numberish,
  salary_percent: numberish,
  salary_amount: numberish,
  benefits_amount: numberish,
  deduct_benefit: numberish,
  benefit_percent: numberish,
  purchase_svc_amount: numberish,
  deduct_service: numberish,
  service_percent: numberish,
  activity_cost_items: z.array(z.unknown()).nullish(),
});
const goalRow = z.object({
  app_goal_id: numberish,
  goal_id: numberish,
  goal_number: optionalText,
  goal_description: optionalText,
});
/** Legacy activityDetailsType, as far as the details tab reads it. */
export const activityRow = z.object({
  activity_id: numberish,
  amend_version_id: numberish,
  activity_number: numberish,
  app_fund_id: numberish,
  activity_status: optionalText,
  activity_status_code: optionalText,
  active_version_flag: optionalText,
  homeless_flag: optionalText,
  goals: z.array(z.unknown()).nullish(),
  activity_type_code: optionalText,
  activity_type: optionalText,
  function_code: optionalText,
  function_code_descr: optionalText,
  object_code: optionalText,
  object_code_descr: optionalText,
  activity_gen_type: z.object({ amount: numberish }).nullish(),
  activity_position_type: positionRow.nullish(),
  total_salary_amount: numberish,
  total_benefits_amount: numberish,
  total_purchase_service_amount: numberish,
  itemization_text: optionalText,
  justification: optionalText,
});
export type ActivityRow = z.infer<typeof activityRow>;
const versionRow = z.object({
  amend_version_id: numberish,
  version_number: numberish,
});

const parsedList = <T extends z.ZodTypeAny>(row: T, raw: unknown) =>
  (Array.isArray(raw) ? raw : []).flatMap((r) => {
    const p = row.safeParse(r);
    return p.success ? [p.data as z.infer<T>] : [];
  });
const coded = (code: unknown, name: unknown) => ({
  code: text(code),
  name: text(name) || text(code),
});

export function activityOfRow(a: ActivityRow): UnitActivity {
  const p = a.activity_position_type;
  return {
    id: text(a.activity_id),
    version: text(a.amend_version_id),
    number: text(a.activity_number),
    fund: text(a.app_fund_id),
    status: a.activity_status ?? "",
    statusCode: a.activity_status_code ?? "",
    activeVersion: a.active_version_flag === "Y",
    homeless: a.homeless_flag ?? "",
    goals: parsedList(goalRow, a.goals).map((g, i) => ({
      key: text(g.app_goal_id) || String(i),
      number: g.goal_number ?? "",
      description: g.goal_description ?? "",
    })),
    type: coded(a.activity_type_code, a.activity_type),
    func: coded(a.function_code, a.function_code_descr),
    object: coded(a.object_code, a.object_code_descr),
    amount: amount(a.activity_gen_type?.amount),
    position: p
      ? {
          fte: coded(p.fte_code, p.fte_code_descr),
          jobTitle: p.job_title ?? "",
          jobDescription: p.job_description ?? "",
          payFrequency: coded(p.pay_frequency_code, p.pay_frequency_code_descr),
          start: text(p.starting_period_no),
          end: text(p.ending_period_no),
          salaryType: coded(p.salary_type_code, p.salary_type_code_descr),
          totalSalary: amount(p.total_salary),
          deductSalary: amount(p.deduct_salary),
          hourlyRate: amount(p.hourly_rate),
          hoursPerDay: amount(p.hours_per_day),
          daysPerYear: amount(p.days_per_year),
          salaryPercent: fraction(p.salary_percent),
          salaryAmount: amount(p.salary_amount),
          benefitsAmount: amount(p.benefits_amount),
          deductBenefit: amount(p.deduct_benefit),
          benefitPercent: fraction(p.benefit_percent),
          purchaseAmount: amount(p.purchase_svc_amount),
          deductService: amount(p.deduct_service),
          servicePercent: fraction(p.service_percent),
          items: parsedList(costItemRow, p.activity_cost_items).flatMap(
            (c, i): UnitCostItem[] =>
              c.category_type_code === "BENEFIT" ||
              c.category_type_code === "PURCHASE_SERVICE"
                ? [
                    {
                      key: `S${i}`,
                      itemId: text(c.item_id),
                      type: c.category_type_code,
                      category: coded(c.category_code, c.category_code_descr),
                      method: coded(
                        c.calc_method_code,
                        c.calc_method_code_descr,
                      ),
                      rate: fraction(c.rate),
                      amount: amount(c.amount),
                    },
                  ]
                : [],
          ),
        }
      : null,
    totals: {
      salary: amount(a.total_salary_amount),
      benefits: amount(a.total_benefits_amount),
      purchase: amount(a.total_purchase_service_amount),
    },
    itemization: a.itemization_text ?? "",
    justification: a.justification ?? "",
  };
}

const ids = z
  .object({
    fund: z.coerce.number().int().positive(),
    activity: z.coerce.number().int().positive(),
    version: z.coerce.number().int().positive(),
  })
  .strict();
type Ids = z.infer<typeof ids>;
export function activityIds(raw: unknown): Ids {
  const parsed = ids.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid activity.", 400);
  return parsed.data;
}

/** One version of an activity on the application's fund; another fund's activity is refused. */
export async function activityOf(
  context: UnitRecordContext,
  q: Ids,
): Promise<{ fund: AppFund; row: ActivityRow }> {
  const fund = fundOf(await appFundsOf(context), q.fund);
  const row = items(
    activityRow,
    await claims.activity({ activityId: q.activity, versionId: q.version }),
  )[0];
  if (
    !row ||
    Number(row.app_fund_id) !== Number(fund.app_fund_id) ||
    Number(row.activity_id) !== q.activity
  )
    throw new AppError("FORBIDDEN", "This activity is not on the fund.", 403);
  return { fund, row };
}

/** Legacy fund_preferences → prefConfig: `{pref_key: pref_value === 'Y'}`. */
export function preferenceOn(fund: AppFund, key: string) {
  return (Array.isArray(fund.fund_preferences) ? fund.fund_preferences : [])
    .map((p) => p as { pref_key?: unknown; pref_value?: unknown })
    .some((p) => p.pref_key === key && p.pref_value === "Y");
}

/** Legacy's sub-tab rules (`fte == 2` is a lump-sum position: no position, claimable tabs). */
function subTabs(a: UnitActivity) {
  const positioned =
    a.type.code === "POSITION" &&
    a.position !== null &&
    a.position.fte.code !== "" &&
    a.position.fte.code !== "2";
  return {
    "general-details": true,
    "position-details": positioned,
    "claimable-amount-details": positioned && a.id !== "",
    "amendment-history-details": a.id !== "",
    "claim-details": a.id !== "",
  } as const;
}

const LABELS: [string, string][] = [
  ["activity-number", "Activity Number"],
  ["amendment-number", "Amendment Number"],
  ["fund-type", "Fund Type"],
  ["status", "Status"],
  ["homeless", "Homeless"],
  ["activity-type", "Activity Type"],
  ["function-code", "Function Code"],
  ["object-code", "Object Code"],
  ["fte", "FTE"],
  ["amount", "Amount"],
  ["salary-amount", "Salary Amount"],
  ["benefits-amount", "Benefits Amount"],
  ["purchased-amount", "Purchased Amount"],
  ["job-title", "Job Title"],
  ["job-description", "Job Description"],
  ["itemization", "Itemization"],
  ["amendment-justification", "Amendment Justification"],
  ["pay-frequency", "Pay Frequency"],
  ["starting-period", "Starting Period"],
  ["ending-period", "Ending Period"],
  ["salary-type", "Salary Type"],
  ["total-salary", "Total Salary"],
  ["deduct-salary", "Deduct Salary"],
  ["hourly-rate", "Hourly Rate"],
  ["hours-per-day", "Hours Per Day"],
  ["days-per-year", "Days Per Year"],
  ["salary-percentage", "Salary Percentage"],
  ["total-benefit", "Total Benefit"],
  ["deduct-benefit", "Deduct Benefit"],
  ["benefit-percentage", "Benefit Percentage"],
  ["total-purchase-service", "Total Purchase Service"],
  ["deduct-service", "Deduct Service"],
  ["service-percentage", "Service Percentage"],
  ["total", "Total"],
];
const HEADERS: [string, string][] = [
  ["goal-number", "Goal Number"],
  ["goal-description", "Goal Description"],
  ["benefit-category", "Category"],
  ["benefit-calculation", "Calculation"],
  ["benefit-rate", "Rate"],
  ["benefit-amount", "Amount"],
  ["purchased-category", "Category"],
  ["purchased-calculation", "Calculation"],
  ["purchased-rate", "Rate"],
  ["purchased-amount", "Amount"],
];
const SUB_TABS: [keyof ReturnType<typeof subTabs>, string][] = [
  ["general-details", "General Details"],
  ["position-details", "Position Details"],
  ["claimable-amount-details", "Claimable Amount"],
  ["amendment-history-details", "Amendment History"],
  ["claim-details", "Claim Details"],
];

/**
 * The activity-details tab for one version (legacy viewActivity → loadActivityDetails, loadActivityVersions): its
 * fields, goals and versions, which sub-tabs it opens, and whether this version can be made the active one.
 */
export async function activityView(
  id: string,
  raw: unknown,
): Promise<UnitActivityView> {
  const q = activityIds(raw);
  const context = await unitRecordRead(id, "activities");
  const [rows, { fund, row }, versions, config] = await Promise.all([
    resources(),
    activityOf(context, q),
    claims.activityVersions({ activityId: q.activity }),
    statusConfig().catch(() => ({})),
  ]);
  const activity = activityOfRow(row);
  const options = items(versionRow, versions).map((v) => ({
    value: text(v.amend_version_id),
    label: text(v.version_number),
  }));
  const open = subTabs(activity);
  const help = (group: string, key: string) =>
    serverFunctions.resources.resourceDescription(rows, BUNDLE, group, key);
  return {
    activity,
    fundName: fund.full_fund_display ?? fund.fund_name ?? "",
    versions: options,
    canSetActive:
      options.length > 1 &&
      !activity.activeVersion &&
      available(config, ["CLAIM_ACTIVITY"], activity.statusCode),
    homeless: preferenceOn(fund, "HOMELESS_FIELD_FLAG"),
    tabs: SUB_TABS.filter(([key]) => open[key]).map(([key, fallback]) => ({
      id: key,
      label: label(rows, "page-name", key, fallback),
    })),
    labels: Object.fromEntries(
      LABELS.map(([key, fallback]) => [
        key,
        label(rows, "labels", key, fallback),
      ]),
    ),
    headers: Object.fromEntries(
      HEADERS.map(([key, fallback]) => [key, header(rows, key, fallback)]),
    ),
    helps: {
      "amendment-number": help("labels", "amendment-number"),
      "salary-information": help("header-labels", "salary-information"),
      "benefit-information": help("header-labels", "benefit-information"),
      "purchase-service-information": help(
        "header-labels",
        "purchase-service-information",
      ),
      salaryHeading: label(
        rows,
        "header-labels",
        "salary-information",
        "Salary Information",
      ),
      benefitHeading: label(
        rows,
        "header-labels",
        "benefit-information",
        "Benefit Information",
      ),
      purchaseHeading: label(
        rows,
        "header-labels",
        "purchase-service-information",
        "Purchase Service Information",
      ),
    },
    empty: label(rows, "helper-texts", "no-data", "No data to display."),
    texts: {
      yes: label(rows, "option-keys", "yes", "Yes"),
      no: label(rows, "option-keys", "no", "No"),
      total: label(rows, "labels", "total", "Total"),
      markActive: label(
        rows,
        "button-labels",
        "mark-as-active",
        "Mark as active",
      ),
      back: label(
        rows,
        "page-name",
        "activity-activities-list",
        "Activities List",
      ),
    },
  };
}

const periodRow = z.object({ period: numberish, amount: numberish });
/** The claimable-amount sub-tab (legacy loadClaimableAmounts): the server's periods; the client only adds them up. */
export async function claimableView(
  id: string,
  raw: unknown,
): Promise<UnitClaimableView> {
  const q = activityIds(raw);
  const context = await unitRecordRead(id, "activities");
  const [rows] = await Promise.all([resources(), activityOf(context, q)]);
  const body = z
    .object({
      salary_periods: z.array(z.unknown()).nullish(),
      benefit_periods: z.array(z.unknown()).nullish(),
      purchase_service_periods: z.array(z.unknown()).nullish(),
    })
    .parse(
      await claims.claimableAmounts({
        activityId: q.activity,
        versionId: q.version,
      }),
    );
  const table = (
    key: "salary" | "benefit" | "purchase",
    heading: string,
    fallback: string,
    list: unknown,
  ) => {
    const periods = parsedList(periodRow, list);
    return {
      key,
      heading: {
        label: label(rows, "header-labels", heading, fallback),
        help: serverFunctions.resources.resourceDescription(
          rows,
          BUNDLE,
          "header-labels",
          heading,
        ),
      },
      headers: {
        period: header(rows, "claimable-period", "Period"),
        amount: header(rows, "claimable-amount", "Amount"),
      },
      rows: periods.map((p, i) => ({
        key: text(p.period) || String(i),
        period: text(p.period),
        amount: amount(p.amount),
      })),
      total: periods.reduce((s, p) => s + (amount(p.amount) ?? 0), 0),
    };
  };
  return {
    tables: [
      table(
        "salary",
        "claimable-salary",
        "Claimable Salary",
        body.salary_periods,
      ),
      table(
        "benefit",
        "claimable-benefit",
        "Claimable Benefit",
        body.benefit_periods,
      ),
      table(
        "purchase",
        "claimable-purchase-service",
        "Claimable Purchase Service",
        body.purchase_service_periods,
      ),
    ],
  };
}

type Column = UnitActivityTable["columns"][number] & { field: string };
const listed = (rawList: unknown, columns: Column[], keyField: string) =>
  (
    z
      .object({ items: z.array(z.record(z.string(), z.unknown())).nullish() })
      .parse(rawList).items ?? []
  ).map((r, i) => ({
    key: text(r[keyField]) || String(i),
    ...Object.fromEntries(
      columns.map((c) => [
        c.key,
        c.money ? amount(r[c.field]) : text(r[c.field]),
      ]),
    ),
  }));
const strip = (columns: Column[]): UnitActivityTable["columns"] =>
  columns.map((c) => omit(c, "field"));

/** The amendment-history sub-tab (legacy getAmendmentHistoryColumns: position amounts or the general amount). */
export async function amendmentHistoryView(
  id: string,
  raw: unknown,
): Promise<UnitActivityTable> {
  const q = activityIds(raw);
  const context = await unitRecordRead(id, "activities");
  const [rows, { row }, list] = await Promise.all([
    resources(),
    activityOf(context, q),
    claims.amendmentHistory({ activityId: q.activity }),
  ]);
  const col = (
    key: string,
    field: string,
    fallback: string,
    kind: { money?: boolean; date?: boolean } = {},
  ): Column => ({
    key,
    field,
    header: { label: label(rows, "table-headers", key, fallback), help: null },
    ...kind,
  });
  const money = { money: true };
  const columns = [
    col("amendment-number", "version_number", "Amendment Number"),
    col("amendment-date", "amend_date", "Amendment Date", { date: true }),
    col("amendment-status", "status_code_descr", "Status"),
    ...(row.activity_type_code === "POSITION"
      ? [
          col(
            "amendment-original-salary",
            "original_salary_amt",
            "Original Salary",
            money,
          ),
          col(
            "amendment-amended-salary",
            "amend_salary_amount",
            "Amended Salary",
            money,
          ),
          col(
            "amendment-original-benefit",
            "original_benefits_amt",
            "Original Benefit",
            money,
          ),
          col(
            "amendment-amended-benefit",
            "amend_benefits_amt",
            "Amended Benefit",
            money,
          ),
          col(
            "amendment-original-purchased",
            "original_purchase_service_amt",
            "Original Purchased",
            money,
          ),
          col(
            "amendment-amended-purchased",
            "amend_purchase_service_amt",
            "Amended Purchased",
            money,
          ),
        ]
      : [
          col(
            "amendment-original-amount",
            "original_amount",
            "Original Amount",
            money,
          ),
          col(
            "amendment-amended-amount",
            "amend_amount",
            "Amended Amount",
            money,
          ),
        ]),
    col("amendment-reason", "reason", "Reason"),
    col("amendment-lines", "no_of_lines", "Lines"),
    col("amendment-itemization", "itemization_text", "Itemization"),
  ];
  return {
    columns: strip(columns),
    rows: listed(list, columns, "version_number"),
  };
}

/** The claim-details sub-tab (legacy loadClaimDetails): the claim lines charged to the activity. */
export async function claimDetailsView(
  id: string,
  raw: unknown,
): Promise<UnitActivityTable> {
  const q = activityIds(raw);
  const context = await unitRecordRead(id, "activities");
  const [rows, , list] = await Promise.all([
    resources(),
    activityOf(context, q),
    claims.claimDetails({ activityId: q.activity }),
  ]);
  const col = (
    key: string,
    field: string,
    fallback: string,
    kind: { money?: boolean; date?: boolean } = {},
  ): Column => ({ key, field, header: header(rows, key, fallback), ...kind });
  const columns = [
    col("claim-number", "claim_number", "Claim Number"),
    col("claim-line-number", "line_no", "Line Number"),
    col("claims-line-status", "line_status_descr", "Status"),
    col("claim-function-code", "function_code_descr", "Function Code"),
    col("claim-object-code", "object_code_descr", "Object Code"),
    col(
      "claim-expenditure-amount",
      "expenditure_amount",
      "Expenditure Amount",
      {
        money: true,
      },
    ),
    col("claim-expenditure-description", "expenditure_descr", "Description"),
    col("claim-paid-out", "roster_name", "Paid Out"),
    col("claim-transaction-date", "transaction_date", "Transaction Date", {
      date: true,
    }),
    col("claim-transaction-number", "transaction_no", "Transaction Number"),
    col("claim-reviewer-comment", "reviewer_comment", "Reviewer Comment"),
  ];
  return {
    columns: strip(columns),
    rows: listed(list, columns, "claim_line_id"),
  };
}

/**
 * WRITES: legacy setActiveVersion. The version must be on the fund, one of several, not active yet, and its status
 * must allow a user edit (legacy hides the button otherwise).
 */
export async function setActiveVersion(id: string, raw: unknown) {
  const q = activityIds(raw);
  const context = await unitRecordRead(id, "activities");
  const [{ row }, versions, config] = await Promise.all([
    activityOf(context, q),
    claims.activityVersions({ activityId: q.activity }),
    statusConfig(),
  ]);
  if (
    items(versionRow, versions).length <= 1 ||
    row.active_version_flag === "Y" ||
    !available(config, ["CLAIM_ACTIVITY"], row.activity_status_code)
  )
    throw new AppError(
      "FORBIDDEN",
      "This version cannot be made the active one.",
      403,
    );
  await claims.setActiveVersion({
    activityId: q.activity,
    versionId: q.version,
  });
  return { activated: true as const };
}
