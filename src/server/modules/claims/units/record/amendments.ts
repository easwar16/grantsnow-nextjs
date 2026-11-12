import "server-only";
import { z } from "zod";
import { claims, lookups } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import type {
  UnitAmendmentLinesView,
  UnitAmendmentsView,
  UnitIncludeView,
} from "@/features/modules/claims/units/listing/types";
import { label, lookupOptions, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appFundsOf, fundOf, items, type AppFund } from "./goals";
import { available, statusConfig, type StatusConfig } from "./status";

const LOOKUPS = "FPCG_AMENDMENT_STATUS,FPCG_AMENDMENT_REASON";
/** Legacy li#amendments: the tab opens only for a fund in one of these statuses. */
export const AMENDMENT_FUND_STATUSES = [
  "IA",
  "ADJ_IA",
  "ADJ_AIA",
  "REWORK",
  "ADJ_REWORK",
];
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const amount = (v: unknown) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);

const amendmentRow = z.object({
  amendment_id: numberish,
  amendment_number: numberish,
  amend_date: optionalText,
  status_code: optionalText,
  status_code_descr: optionalText,
  reason: optionalText,
  reason_descr: optionalText,
  cost_difference: numberish,
  no_of_lines: numberish,
});
const lineRow = z.object({
  amendment_id: numberish,
  activity_id: numberish,
  amend_version_id: numberish,
  activity_number: numberish,
  status_code: optionalText,
  function_code: optionalText,
  object_code: optionalText,
  activity_type: optionalText,
  current_salary_amt: numberish,
  current_benefits_amt: numberish,
  current_purchase_service_amt: numberish,
  current_amount: numberish,
  amend_salary_amt: numberish,
  amend_benefits_amt: numberish,
  amend_purchase_service_amt: numberish,
  amend_amount: numberish,
  cost_difference: numberish,
  justification: optionalText,
  itemization_text: optionalText,
  job_title: optionalText,
});
const candidateRow = z.object({
  activity_id: numberish,
  amend_version_id: numberish,
  activity_number: numberish,
  activity_type_code: optionalText,
  activity_type: optionalText,
  function_code: optionalText,
  object_code: optionalText,
  salary_amount: numberish,
  benefits_amount: numberish,
  purchase_service_amount: numberish,
  non_position_cost: numberish,
  job_title: optionalText,
  itemization_text: optionalText,
});

const right = (context: UnitRecordContext, kind: "edit" | "delete") =>
  context.access.roles.get("activity-amendment")?.[kind] === true;
/** A new amendment (no status yet) is open; otherwise its status must allow a user edit. */
const amendmentOpen = (config: StatusConfig, status: string) =>
  status === "" || available(config, ["CLAIM_FUNDS_AMENDMENT"], status);

/** The record, the fund (refused when its status opens no Amendments tab) and the status config. */
async function amendmentContext(id: string, rawFund: unknown) {
  const context = await unitRecordRead(id, "activities");
  const [funds, config] = await Promise.all([
    appFundsOf(context),
    statusConfig(),
  ]);
  const fund = fundOf(funds, rawFund);
  if (!AMENDMENT_FUND_STATUSES.includes(text(fund.fund_status_code)))
    throw new AppError(
      "FORBIDDEN",
      "Amendments are not open for this fund's status.",
      403,
    );
  return { context, fund, config };
}
const listOf = async (context: UnitRecordContext, fund: AppFund, status = "") =>
  items(
    amendmentRow,
    await claims.amendments({
      appFundId: Number(fund.app_fund_id),
      orgId: context.user.organizationId,
      status,
    }),
  );
/** The fund's amendment, refused when it is not one of its amendments. */
async function amendmentOf(
  context: UnitRecordContext,
  fund: AppFund,
  raw: unknown,
) {
  const amendmentId = z.coerce.number().int().positive().safeParse(raw);
  const row = amendmentId.success
    ? (await listOf(context, fund)).find(
        (a) => Number(a.amendment_id) === amendmentId.data,
      )
    : undefined;
  if (!row)
    throw new AppError("FORBIDDEN", "This amendment is not on the fund.", 403);
  return row;
}

/** The Amendments sub-tab (legacy loadAmendmentsList with its filter, reason list and gates). */
export async function amendmentsView(
  id: string,
  rawFund: unknown,
  rawStatus: string | null,
): Promise<UnitAmendmentsView> {
  const { context, fund, config } = await amendmentContext(id, rawFund);
  const status = /^[A-Z_]{0,30}$/.test(rawStatus ?? "")
    ? (rawStatus ?? "")
    : "";
  const [rows, codes, list] = await Promise.all([
    resources(),
    lookups.codes({ types: LOOKUPS }),
    listOf(context, fund, status),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const edit = right(context, "edit"),
    remove = right(context, "delete");
  return {
    fund: text(fund.app_fund_id),
    statuses: [
      { value: "", label: "All" },
      ...lookupOptions(codes, "FPCG_AMENDMENT_STATUS"),
    ],
    status,
    reasons: lookupOptions(codes, "FPCG_AMENDMENT_REASON"),
    canCreate: edit,
    rows: list.map((a) => {
      const statusCode = text(a.status_code);
      return {
        key: text(a.amendment_id),
        number: text(a.amendment_number),
        date: text(a.amend_date),
        status: text(a.status_code_descr),
        statusCode,
        reason: text(a.reason_descr),
        reasonCode: text(a.reason),
        cost: amount(a.cost_difference),
        lines: text(a.no_of_lines),
        editable: edit && amendmentOpen(config, statusCode),
        deletable: remove && amendmentOpen(config, statusCode),
      };
    }),
    headers: Object.fromEntries(
      (
        [
          ["amendment-number", "Amendment Number"],
          ["amendment-date", "Amendment Date"],
          ["amendment-status", "Status"],
          ["amendment-reason", "Reason"],
          ["amendment-cost-difference", "Cost Difference"],
          ["amendment-lines-number", "Lines"],
        ] as const
      ).map(([k, fallback]) => [k, t("table-headers", k, fallback)]),
    ),
    texts: {
      status: t("labels", "amendment-status", "Amendment Status"),
      reason: t("labels", "amendment-reason", "Amendment Reason"),
      create: t("button-labels", "new-amendment", "New Amendment"),
      include: t("button-labels", "include-activity", "Include Activity"),
      add: t("button-labels", "add-activity", "Add Activity"),
      save: t("button-labels", "save", "Save"),
      view: t("button-labels", "view", "View"),
      delete: t("button-labels", "delete", "Delete"),
      deleteTitle: t(
        "dialog-titles",
        "approval-delete-warning",
        "Delete Warning",
      ),
      deleteText: t(
        "warning-messages",
        "approval-permanent-delete",
        "This will permanently delete the record. Do you want to continue?",
      ),
      yes: t("button-labels", "yes", "Yes"),
      no: t("button-labels", "no", "No"),
      empty: t("helper-texts", "no-data", "No data to display."),
      total: t("labels", "total", "Total"),
    },
  };
}

/** One amendment's lines (legacy loadAmendmentLines); a line is removable while the amendment is open. */
export async function amendmentLinesView(
  id: string,
  rawFund: unknown,
  rawAmendment: unknown,
): Promise<UnitAmendmentLinesView> {
  const { context, fund, config } = await amendmentContext(id, rawFund);
  const [rows, amendment] = await Promise.all([
    resources(),
    amendmentOf(context, fund, rawAmendment),
  ]);
  const lines = items(
    lineRow,
    await claims.amendmentLines({
      amendmentId: Number(amendment.amendment_id),
    }),
  );
  const open = amendmentOpen(config, text(amendment.status_code));
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    amendment: text(amendment.amendment_id),
    // Legacy gated a line's delete on the line's status; the amendment's decides here, as for the whole edit row.
    deletable: right(context, "delete") && open,
    editable: right(context, "edit") && open,
    rows: lines.map((l) => ({
      key: text(l.amend_version_id),
      activity: text(l.activity_id),
      version: text(l.amend_version_id),
      number: text(l.activity_number),
      func: text(l.function_code),
      object: text(l.object_code),
      type: text(l.activity_type),
      currentSalary: amount(l.current_salary_amt),
      currentBenefits: amount(l.current_benefits_amt),
      currentPurchase: amount(l.current_purchase_service_amt),
      currentAmount: amount(l.current_amount),
      amendSalary: amount(l.amend_salary_amt),
      amendBenefits: amount(l.amend_benefits_amt),
      amendPurchase: amount(l.amend_purchase_service_amt),
      amendAmount: amount(l.amend_amount),
      cost: amount(l.cost_difference),
      justification: text(l.justification),
      itemization: text(l.itemization_text),
      jobTitle: text(l.job_title),
    })),
    headers: Object.fromEntries(
      (
        [
          // Legacy's key is spelled "acivity-number".
          ["acivity-number", "Activity Number"],
          ["function-code", "Function Code"],
          ["object-code", "Object Code"],
          ["activity-type", "Activity Type"],
          ["current-salary", "Current Salary"],
          ["current-benefit", "Current Benefit"],
          ["current-purchase-service", "Current Purchase Service"],
          ["current-non-position", "Current Non Position"],
          ["amended-salary", "Amended Salary"],
          ["amended-benefit", "Amended Benefit"],
          ["amended-purchase-service", "Amended Purchase Service"],
          ["amended-non-position", "Amended Non Position"],
          ["cost-difference", "Cost Difference"],
          ["justification", "Justification"],
          ["updated-itemization", "Updated Itemization"],
          ["job-title", "Job Title"],
        ] as const
      ).map(([k, fallback]) => [k, t("table-headers", k, fallback)]),
    ),
  };
}

/** Include Activity's picker (legacy loadActivityList in amendment mode: every status, as the amendment sees them). */
export async function includeView(
  id: string,
  rawFund: unknown,
  rawAmendment: unknown,
): Promise<UnitIncludeView> {
  const { context, fund } = await amendmentContext(id, rawFund);
  if (!right(context, "edit"))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change amendments.",
      403,
    );
  const amendment = rawAmendment
    ? await amendmentOf(context, fund, rawAmendment)
    : undefined;
  const [rows, candidates] = await Promise.all([
    resources(),
    candidatesOf(context, fund, amendment?.amendment_id),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    rows: candidates.map((c) => ({
      key: `${text(c.activity_id)}-${text(c.amend_version_id)}`,
      activity: text(c.activity_id),
      version: text(c.amend_version_id),
      number: text(c.activity_number),
      func: text(c.function_code),
      object: text(c.object_code),
      type: text(c.activity_type),
      salary: amount(c.salary_amount),
      benefits: amount(c.benefits_amount),
      purchase: amount(c.purchase_service_amount),
      nonPosition: amount(c.non_position_cost),
      jobTitle: text(c.job_title),
      itemization: text(c.itemization_text),
    })),
    headers: Object.fromEntries(
      (
        [
          ["number", "No"],
          ["function-code", "Function Code"],
          ["object-code", "Object Code"],
          ["activity-type", "Activity Type"],
          ["salary-amount", "Salary Amount"],
          ["benefit-amount", "Benefit Amount"],
          ["purchase-service-amount", "Purchase Service Amount"],
          ["non-position-cost", "Non Position Cost"],
          ["job-title", "Job Title"],
          ["itemization", "Itemization"],
        ] as const
      ).map(([k, fallback]) => [k, t("table-headers", k, fallback)]),
    ),
    texts: {
      title: t("button-labels", "include-activity", "Include Activity"),
      include: t("button-labels", "include-activity", "Include Activity"),
      select: t("labels", "select", "Select"),
    },
  };
}
const candidatesOf = async (
  context: UnitRecordContext,
  fund: AppFund,
  amendmentId: unknown,
) =>
  items(
    candidateRow,
    await claims.activities({
      appFundId: Number(fund.app_fund_id),
      orgId: context.user.organizationId,
      status: "",
      ...(amendmentId ? { amendmentId: Number(amendmentId) } : {}),
    }),
  );

const reasonOf = async (raw: string) => {
  const codes = await lookups.codes({ types: LOOKUPS });
  if (
    !lookupOptions(codes, "FPCG_AMENDMENT_REASON").some((o) => o.value === raw)
  )
    throw new AppError(
      "BAD_REQUEST",
      "Please select valid amendment reason..",
      400,
    );
  return raw;
};
/** The edit gate for an amendment write: the right, and an open (or new) amendment. */
async function editable(id: string, rawFund: unknown, rawAmendment: unknown) {
  const { context, fund, config } = await amendmentContext(id, rawFund);
  if (!right(context, "edit"))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change amendments.",
      403,
    );
  const amendment = rawAmendment
    ? await amendmentOf(context, fund, rawAmendment)
    : undefined;
  if (amendment && !amendmentOpen(config, text(amendment.status_code)))
    throw new AppError(
      "FORBIDDEN",
      "This amendment cannot be changed in its current status.",
      403,
    );
  return { context, fund, config, amendment };
}

const includeInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    amendment: z.coerce.number().int().positive().optional(),
    reason: z.string().min(1).max(40),
    activities: z
      .array(
        z
          .object({
            activity: z.coerce.number().int().positive(),
            version: z.coerce.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
/**
 * WRITES: includes existing activities in the amendment (legacy includeActivity, postIncludeAmendActivity); the
 * first include mints the amendment. The activities must be the fund's, as the picker listed them.
 */
export async function includeActivities(id: string, raw: unknown) {
  const parsed = includeInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Please select at least one activity..",
      400,
    );
  const input = parsed.data;
  const { context, fund, amendment } = await editable(
    id,
    input.fund,
    input.amendment,
  );
  const [reason, candidates] = await Promise.all([
    reasonOf(input.reason),
    candidatesOf(context, fund, amendment?.amendment_id),
  ]);
  const chosen = input.activities.map((a) => {
    const c = candidates.find(
      (x) =>
        Number(x.activity_id) === a.activity &&
        Number(x.amend_version_id) === a.version,
    );
    if (!c)
      throw new AppError("FORBIDDEN", "This activity is not on the fund.", 403);
    return {
      activity_id: a.activity,
      amend_version_id: a.version,
      activity_type_code: text(c.activity_type_code),
    };
  });
  const result = await claims.includeInAmendment({
    appFundId: Number(fund.app_fund_id),
    amendmentId: amendment ? Number(amendment.amendment_id) : undefined,
    body: {
      fund_type_id: Number(fund.fund_type_id),
      reason,
      includeActivities: chosen,
    },
  });
  const minted = z
    .object({ items: z.array(z.object({ amendment_id: numberish })).nullish() })
    .safeParse(result);
  return {
    amendment:
      text(minted.success ? minted.data.items?.[0]?.amendment_id : "") ||
      text(amendment?.amendment_id),
  };
}

const saveInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    amendment: z.coerce.number().int().positive(),
    reason: z.string().min(1).max(40),
  })
  .strict();
/** WRITES: saves the amendment's reason (legacy saveAmendment); every line needs its justification and itemization. */
export async function saveAmendment(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Please select valid amendment reason..",
      400,
    );
  const input = parsed.data;
  const { amendment } = await editable(id, input.fund, input.amendment);
  const [reason, lines] = await Promise.all([
    reasonOf(input.reason),
    claims.amendmentLines({ amendmentId: input.amendment }),
  ]);
  const missing = items(lineRow, lines).find(
    (l) => !text(l.itemization_text).trim() || !text(l.justification).trim(),
  );
  if (missing)
    throw new AppError(
      "BAD_REQUEST",
      `Please check Justification/Itemization for Activity: ${text(missing.activity_number)}`,
      400,
    );
  await claims.saveAmendment({
    amendmentId: Number(amendment!.amendment_id),
    body: { reason },
  });
  return { saved: true as const };
}

const deleteInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    amendment: z.coerce.number().int().positive(),
    version: z.coerce.number().int().positive().optional(),
  })
  .strict();
/** WRITES: removes an amendment, or (with `version`) one of its lines; the right and an open amendment are checked. */
export async function deleteAmendment(id: string, raw: unknown) {
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid amendment.", 400);
  const input = parsed.data;
  const { context, fund, config } = await amendmentContext(id, input.fund);
  const amendment = await amendmentOf(context, fund, input.amendment);
  if (
    !right(context, "delete") ||
    !amendmentOpen(config, text(amendment.status_code))
  )
    throw new AppError(
      "FORBIDDEN",
      "This amendment cannot be changed in its current status.",
      403,
    );
  if (input.version === undefined) {
    await claims.deleteAmendment({ amendmentId: input.amendment });
    return { deleted: true as const };
  }
  const lines = items(
    lineRow,
    await claims.amendmentLines({ amendmentId: input.amendment }),
  );
  if (!lines.some((l) => Number(l.amend_version_id) === input.version))
    throw new AppError("FORBIDDEN", "This line is not on the amendment.", 403);
  await claims.deleteAmendmentLine({
    amendmentId: input.amendment,
    versionId: input.version,
  });
  return { deleted: true as const };
}

/** For the activity form in amendment mode: the gate and the amendment, if there is one yet. */
export async function amendmentGate(
  id: string,
  rawFund: unknown,
  rawAmendment: unknown,
) {
  return editable(id, rawFund, rawAmendment);
}

/** An amendment's approval document facts (legacy amendment Submit / Withdraw gates): its status and line count. */
export async function amendmentApproval(
  id: string,
  rawFund: unknown,
  rawAmendment: unknown,
) {
  const { context, fund, config } = await amendmentContext(id, rawFund);
  const amendment = await amendmentOf(context, fund, rawAmendment);
  const lines = items(
    lineRow,
    await claims.amendmentLines({
      amendmentId: Number(amendment.amendment_id),
    }),
  );
  return {
    context,
    fund,
    config,
    amendmentId: text(amendment.amendment_id),
    status: text(amendment.status_code),
    lines: lines.length,
  };
}
