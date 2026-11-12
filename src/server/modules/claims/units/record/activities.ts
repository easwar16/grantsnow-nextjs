import "server-only";
import { z } from "zod";
import { claims, lookups } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import type {
  UnitFundBar,
  UnitActivitiesView,
  UnitActivityList,
  UnitFundSummary,
} from "@/features/modules/claims/units/listing/types";
import {
  label,
  lookupOptions,
  numberish,
  optionalText,
  visible,
} from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appFundsOf, fundOf, header, items } from "./goals";
import { available, statusConfig, type StatusConfig } from "./status";
import { AMENDMENT_FUND_STATUSES } from "./amendments";

const LOOKUPS = "FPCG_ACTIVITY_PERIOD,FPCG_FUND_STATUS,FPCG_ACTIVITY_STATUS";
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const amount = (v: unknown) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);

const categoryRow = z.object({
  category: optionalText,
  pending: numberish,
  review: numberish,
  approved: numberish,
  rejected: numberish,
});
const summaryRow = z.object({
  fund_status_code: optionalText,
  total_budget: numberish,
  activity_amount: numberish,
  unapplied_balance: numberish,
  approved_amount: numberish,
  last_date_for_claim: optionalText,
  last_date_for_amendment: optionalText,
  grant_category_name: optionalText,
  grant_value: optionalText,
  payment_account_code: optionalText,
  holding_account_code: optionalText,
  categories: z.array(categoryRow).nullish(),
  requirements: z
    .array(
      z.object({
        req_id: numberish,
        form_id: numberish,
        req_type_code: optionalText,
        reference_module: optionalText,
      }),
    )
    .nullish(),
});
const functionRow = z.object({
  function_code: optionalText,
  function_description: optionalText,
  obj_100: numberish,
  obj_200: numberish,
  obj_300: numberish,
  obj_400: numberish,
  obj_500: numberish,
  function_total: numberish,
});
const activityRow = z.object({
  activity_id: numberish,
  amend_version_id: numberish,
  activity_number: numberish,
  function_code: optionalText,
  object_code: optionalText,
  activity_type: optionalText,
  ref_goals: z.unknown(),
  total_amount: numberish,
  job_title: optionalText,
  itemization_text: optionalText,
  fte: numberish,
  status: optionalText,
  status_code: optionalText,
  homeless: optionalText,
  amended: optionalText,
  function_descr: optionalText,
  object_descr: optionalText,
});

/** The fund's activity header (legacy loadActivitySummary: getFundsCategories, `items[0]`). */
export async function summaryOf(context: UnitRecordContext, appFundId: number) {
  return items(
    summaryRow,
    await claims.fundCategories({
      appFundId,
      orgId: context.user.organizationId,
    }),
  )[0];
}
async function fundIn(context: UnitRecordContext, raw: unknown) {
  return fundOf(await appFundsOf(context), raw);
}
/** Legacy Add Activity: activity-details edit and a fund status that allows a user edit (CLAIM_FUNDS). */
export const canAddActivity = (
  context: UnitRecordContext,
  config: StatusConfig,
  fundStatus: string | null | undefined,
) =>
  context.access.roles.get("activity-details")?.edit === true &&
  available(config, ["CLAIM_FUNDS"], fundStatus);
const canDelete = (context: UnitRecordContext) =>
  context.access.roles.get("activity-details")?.delete === true;

/**
 * The tab's header (legacy claims-unit-activities initialize → loadAppFunds, loadLookups, loadActivitySummary): the
 * application's funds (the first unless `fund` names another), the filter choices, and the fund's summary panels.
 */
export async function activitiesView(
  id: string,
  rawFund: string | null,
): Promise<UnitActivitiesView> {
  const context = await unitRecordRead(id, "activities");
  const [rows, funds, codes, config] = await Promise.all([
    resources(),
    appFundsOf(context),
    lookups.codes({ types: LOOKUPS }),
    statusConfig().catch(() => ({})),
  ]);
  const fund = rawFund ? fundOf(funds, rawFund) : funds[0];
  const [summary, planned] = fund
    ? await Promise.all([
        summaryOf(context, Number(fund.app_fund_id)),
        activitiesOf(context, Number(fund.app_fund_id), ""),
      ])
    : [undefined, []];
  const fundStatus = text(summary?.fund_status_code);
  const all = { value: "", label: "All" };
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    fund: fund ? text(fund.app_fund_id) : "",
    // Legacy shows Add Activity on the Activities List with the right and an editable fund status.
    add: fund
      ? canAddActivity(context, config, summary?.fund_status_code)
        ? t("button-labels", "add-activity", "Add Activity")
        : null
      : null,
    funds: funds.map((f) => ({
      value: text(f.app_fund_id),
      label: f.full_fund_display ?? f.fund_name ?? "",
    })),
    periods: lookupOptions(codes, "FPCG_ACTIVITY_PERIOD"),
    statuses: [all, ...lookupOptions(codes, "FPCG_ACTIVITY_STATUS")],
    labels: {
      fund: t("labels", "fund-type", "Fund Type"),
      period: t("labels", "period", "Period"),
      status: t("labels", "status", "Status"),
    },
    ...fundBarOf(rows, codes, summary, [
      ["total-allocation", "Total Allocation", summary?.total_budget],
      ["activity-amount", "Activity Amount", summary?.activity_amount],
      // Legacy colours a negative Unapplied Balance red.
      [
        "unapplied-balance",
        "Unapplied Balance",
        summary?.unapplied_balance,
        true,
      ],
      ["approved-amount", "Approved Amount", summary?.approved_amount],
    ]),
    tabs: [
      {
        id: "fund-summary",
        label: t("page-name", "activity-fund-summary", "Fund Summary"),
      },
      {
        id: "activities-list",
        label: t("page-name", "activity-activities-list", "Activities List"),
      },
      // Legacy li#amendments: only for a fund whose status allows amendments (hidden otherwise, owner rule).
      ...(AMENDMENT_FUND_STATUSES.includes(text(summary?.fund_status_code))
        ? [
            {
              id: "amendments" as const,
              label: t("page-name", "activity-amendments", "Amendments"),
            },
          ]
        : []),
    ],
    empty: t("helper-texts", "no-data", "No data to display."),
    texts: {
      total: t("labels", "total", "Total"),
      delete: t("button-labels", "delete", "Delete"),
      view: t("button-labels", "view", "View"),
      details: t("page-name", "activity-details", "Activity Details"),
      roster: t("labels", "roster", "Roster"),
      equipment: t("labels", "furniture-equipment", "Furniture & Equipment"),
    },
    // Legacy says why Submit for Approval is missing: a planned draft or rework whose Unapplied Balance is not 0.
    submitHint:
      ["DRFT", "REWORK"].includes(fundStatus) &&
      planned.length > 0 &&
      Number(summary?.unapplied_balance) !== 0 &&
      available(config, ["CLAIM_FUNDS", "CLAIM_FUNDS_AMENDMENT"], fundStatus)
        ? t(
            "helper-texts",
            "submit-needs-zero-unapplied",
            "Submit for Approval appears once the Unapplied Balance is 0, that is, once every allocated amount is planned into activities.",
          )
        : null,
  };
}

const periodOf = (raw: string | null) =>
  /^[A-Z0-9_]{1,30}$/.test(raw ?? "") ? raw! : "CURRENT";

/** The Fund Summary table (legacy loadFundSummary), its totals summed as legacy does (a missing amount adds 0). */
export async function fundSummaryView(
  id: string,
  rawFund: string | null,
  rawPeriod: string | null,
): Promise<UnitFundSummary> {
  const context = await unitRecordRead(id, "activities");
  const [rows, fund] = await Promise.all([
    resources(),
    fundIn(context, rawFund),
  ]);
  const list = items(
    functionRow,
    await claims.activitySummary({
      appFundId: Number(fund.app_fund_id),
      period: periodOf(rawPeriod),
    }),
  );
  const sum = (key: keyof z.infer<typeof functionRow>) =>
    list.reduce((s, r) => s + (amount(r[key]) ?? 0), 0);
  return {
    headers: {
      function: header(rows, "function", "Function"),
      salaries: header(rows, "salaries", "Salaries"),
      benefits: header(rows, "employee-benefits", "Employee Benefits"),
      services: header(rows, "purchased-services", "Purchased Services"),
      supplies: header(rows, "supplies-materials", "Supplies & Materials"),
      capital: header(rows, "capital-outlay", "Capital Outlay"),
      total: header(rows, "total", "Total"),
      description: header(rows, "function-description", "Function Description"),
    },
    rows: list.map((r, i) => ({
      key: r.function_code ?? String(i),
      function: r.function_code ?? "",
      salaries: amount(r.obj_100),
      benefits: amount(r.obj_200),
      services: amount(r.obj_300),
      supplies: amount(r.obj_400),
      capital: amount(r.obj_500),
      total: amount(r.function_total),
      description: r.function_description ?? "",
    })),
    totals: {
      salaries: sum("obj_100"),
      benefits: sum("obj_200"),
      services: sum("obj_300"),
      supplies: sum("obj_400"),
      capital: sum("obj_500"),
      total: sum("function_total"),
    },
  };
}

const statusOf = (raw: string | null) =>
  /^[A-Z0-9_]{1,30}$/.test(raw ?? "") ? raw! : "";
/** The fund's activities (getActivities), refused for a fund not on the application. */
export async function activitiesOf(
  context: UnitRecordContext,
  appFundId: number,
  status: string,
) {
  return items(
    activityRow,
    await claims.activities({
      appFundId,
      orgId: context.user.organizationId,
      status,
    }),
  );
}
/** Legacy binds `ref_goals` as text; a list shows its entries joined. */
const goalsText = (v: unknown) =>
  Array.isArray(v) ? v.map(text).filter(Boolean).join(", ") : text(v);
const yesNo = (v: string | null | undefined) => (v === "Y" ? "Yes" : "No");

/** The Activities List (legacy loadActivityList), filtered by status; its total sums `total_amount` (missing adds 0). */
export async function activityListView(
  id: string,
  rawFund: string | null,
  rawStatus: string | null,
): Promise<UnitActivityList> {
  const context = await unitRecordRead(id, "activities");
  const [rows, fund, config] = await Promise.all([
    resources(),
    fundIn(context, rawFund),
    statusConfig().catch(() => ({})),
  ]);
  const list = await activitiesOf(
    context,
    Number(fund.app_fund_id),
    statusOf(rawStatus),
  );
  const deletes = canDelete(context);
  return {
    headers: {
      number: header(rows, "number", "Number"),
      functionCode: header(rows, "function-code", "Function Code"),
      objectCode: header(rows, "object-code", "Object Code"),
      type: header(rows, "activity-type", "Activity Type"),
      goals: header(rows, "ref-goal", "Ref Goal"),
      amount: header(rows, "total-amount", "Total Amount"),
      jobTitle: header(rows, "job-title", "Job Title"),
      itemization: header(rows, "itemization", "Itemization"),
      fte: header(rows, "fte", "FTE"),
      status: header(rows, "status", "Status"),
      homeless: header(rows, "homeless", "Homeless"),
      amended: header(rows, "amended", "Amended"),
      functionDescription: header(
        rows,
        "function-description",
        "Function Description",
      ),
      objectDescription: header(
        rows,
        "object-description",
        "Object Description",
      ),
    },
    rows: list.map((a, i) => ({
      key: text(a.activity_id) || String(i),
      version: text(a.amend_version_id),
      number: text(a.activity_number),
      functionCode: a.function_code ?? "",
      objectCode: a.object_code ?? "",
      type: a.activity_type ?? "",
      goals: goalsText(a.ref_goals),
      amount: amount(a.total_amount),
      jobTitle: a.job_title ?? "",
      itemization: a.itemization_text ?? "",
      fte: text(a.fte),
      status: a.status ?? "",
      homeless: yesNo(a.homeless),
      amended: yesNo(a.amended),
      functionDescription: a.function_descr ?? "",
      objectDescription: a.object_descr ?? "",
      deletable:
        deletes && available(config, ["CLAIM_ACTIVITY"], a.status_code),
    })),
    total: list.reduce((s, a) => s + (amount(a.total_amount) ?? 0), 0),
  };
}

const deleteInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    activity: z.coerce.number().int().positive(),
    version: z.coerce.number().int().positive(),
  })
  .strict();

/**
 * WRITES: legacy deleteActivity. The activity version must be on the fund, the user needs `activity-details` delete,
 * and its status must allow a user edit. Answers legacy unappliedBalanceChanged's warning when the balance moved
 * below 0.
 */
export async function deleteActivity(id: string, raw: unknown) {
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid activity.", 400);
  const input = parsed.data;
  const context = await unitRecordRead(id, "activities");
  const [fund, config] = await Promise.all([
    fundIn(context, input.fund),
    statusConfig(),
  ]);
  const appFundId = Number(fund.app_fund_id);
  const [list, before] = await Promise.all([
    activitiesOf(context, appFundId, ""),
    summaryOf(context, appFundId),
  ]);
  const row = list.find(
    (a) =>
      Number(a.activity_id) === input.activity &&
      Number(a.amend_version_id) === input.version,
  );
  if (!row)
    throw new AppError("FORBIDDEN", "This activity is not on the fund.", 403);
  if (
    !canDelete(context) ||
    !available(config, ["CLAIM_ACTIVITY"], row.status_code)
  )
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to delete this activity.",
      403,
    );
  await claims.deleteActivity({
    activityId: input.activity,
    versionId: input.version,
  });
  const [rows, after] = await Promise.all([
    resources(),
    summaryOf(context, appFundId),
  ]);
  return {
    deleted: true as const,
    warning: unappliedWarning(
      rows,
      before?.unapplied_balance,
      after?.unapplied_balance,
    ),
  };
}

/** Legacy unappliedBalanceChanged: a warning when the balance changed and is now below 0 (it never blocks). */
export function unappliedWarning(
  rows: Resources,
  beforeValue: unknown,
  afterValue: unknown,
) {
  const prev = amount(beforeValue),
    next = amount(afterValue);
  return next !== null && next !== prev && next < 0
    ? {
        summary: label(
          rows,
          "warning-messages",
          "unapplied-summary",
          "The claim cannot be submitted while the Unapplied Balance is negative.",
        ),
        message: label(
          rows,
          "warning-messages",
          "unapplied-message",
          "Please adjust the activity amounts until the Unapplied Balance is 0 before submitting for approval.",
        ),
      }
    : null;
}

/** A figure of the fund bar: RB key, fallback, raw amount, and whether a negative shows red. */
export type FundAmount = [string, string, unknown, boolean?];
/**
 * The unit record's fund bar (MR 15893, Activities and Claims tabs): the fund status, the tab's figures, the dates
 * the fund has, the grant fields whose RB row is visible, and the category counts.
 */
export function fundBarOf(
  rows: Resources,
  codes: unknown,
  summary: z.infer<typeof summaryRow> | undefined,
  amounts: FundAmount[],
  dates: ("claim" | "amendment")[] = ["claim", "amendment"],
): UnitFundBar {
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    status: {
      label: t("labels", "fund-status", "Fund Status"),
      value:
        lookupOptions(codes, "FPCG_FUND_STATUS").find(
          (o) => o.value === summary?.fund_status_code,
        )?.label ?? text(summary?.fund_status_code),
    },
    amounts: amounts.map(([key, fallback, v, warnNegative]) => {
      const value = amount(v);
      return {
        key,
        label: t("labels", key, fallback),
        value,
        danger: warnNegative === true && value !== null && value < 0,
      };
    }),
    // MR 15893 fund bar: the dates when the fund has them, the grant fields when their RB row is visible.
    dates: (
      [
        [
          "claim",
          "summary-claim-date",
          "Claim Date",
          summary?.last_date_for_claim,
        ],
        [
          "amendment",
          "summary-amendment-date",
          "Amendment Date",
          summary?.last_date_for_amendment,
        ],
      ] as const
    )
      .filter(([key, , , v]) => dates.includes(key) && Boolean(v))
      .map(([key, rbKey, fallback, v]) => ({
        key,
        label: t("table-headers", rbKey, fallback),
        value: v!,
      })),
    grant: (
      [
        ["grant-category-name", "Grant Category", summary?.grant_category_name],
        ["grant-value-id", "Grant", summary?.grant_value],
        [
          "payment-account-code",
          "Payment Account",
          summary?.payment_account_code,
        ],
        [
          "holding-account-code",
          "Holding Account",
          summary?.holding_account_code,
        ],
      ] as const
    )
      .filter(([key]) => visible(rows, "labels", key))
      .map(([key, fallback, v]) => ({
        key,
        label: t("labels", key, fallback),
        value: v ?? "",
      })),
    categories: {
      headers: {
        category: header(rows, "category", "Category"),
        pending: header(rows, "pending", "Pending"),
        review: header(rows, "review", "Review"),
        approved: header(rows, "approved", "Approved"),
        rejected: header(rows, "rejected", "Rejected"),
      },
      rows: (summary?.categories ?? []).map((c, i) => ({
        key: c.category ?? String(i),
        category: c.category ?? "",
        pending: text(c.pending),
        review: text(c.review),
        approved: text(c.approved),
        rejected: text(c.rejected),
      })),
    },
  };
}
