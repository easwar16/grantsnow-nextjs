import "server-only";
import omit from "lodash/omit";
import moment from "moment";
import { z } from "zod";
import { approvals, claims, lookups, reports } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { AppError } from "@/lib/errors";
import type {
  ClaimHierarchy,
  ClaimLineDraft,
  UnitClaimEditView,
  UnitRejectedLines,
  UnitClaimView,
  UnitClaimList,
  UnitClaimsSummary,
  UnitClaimsView,
} from "@/features/modules/claims/units/listing/types";
import {
  label,
  lookupOptions,
  numberish,
  optionalText,
  visible,
} from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { fundBarOf, type FundAmount } from "./activities";
import { appFundsOf, fundOf, header, items } from "./goals";
import { available, statusConfig, type StatusConfig } from "./status";
import { appSummaryOf } from "./shell";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { claimPeriodRange, monthOf } from "@/shared/claims/claim-period";

const LOOKUPS = "FPCG_FUND_STATUS,FPCG_CLAIM_STATUS";
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const amount = (v: unknown) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
const num = (v: unknown) => Number(v) || 0;

const claimRow = z.object({
  claim_id: numberish,
  claim_number: optionalText,
  claim_date: optionalText,
  claim_status_code: optionalText,
  claim_status_descr: optionalText,
  paid_date: optionalText,
  po_number: optionalText,
  claim_period_month_name: optionalText,
  claim_amount: numberish,
  approved_amount: numberish,
  approved_adjust_amount: numberish,
  total_adjust_amount: numberish,
  paid_amount: numberish,
  claim_line_count: numberish,
  rejected_line_count: numberish,
  adjustment_count: numberish,
});
type ClaimRow = z.infer<typeof claimRow>;
const OBJECTS = ["100", "200", "300", "400", "500"] as const;
const summaryRow = z.object({
  function_code: optionalText,
  function_description: optionalText,
  function_total_claimed: numberish,
  ...Object.fromEntries(
    OBJECTS.flatMap((o) => [
      [`obj_${o}_claimed`, numberish],
      [`obj_${o}_balance`, numberish],
    ]),
  ),
});
/** Statuses whose claim can be cloned (legacy clone gate) and that count as approved for Remaining to Claim. */
const SETTLED = ["IA", "PAYMENT_IP", "PAID"];
const COUNTED = ["IA", "PAYMENT_IP", "PAID", "PAID_ADJUST", "PAY_INELIGIBLE"];
/** Legacy: Adjustments open for an approved or paid claim (claimsTabs' `claims-adjustments` gate). */
export const ADJUSTABLE = COUNTED;

/** Legacy getClaimFigures over every claim of the fund; Remaining to Claim needs the fund's approved amount. */
export function claimFigures(rows: ClaimRow[], approvedActivities: unknown) {
  const sum = (f: (r: ClaimRow) => number) =>
    rows.reduce((s, r) => s + f(r), 0);
  const status = (r: ClaimRow) => text(r.claim_status_code);
  const counted = sum((r) =>
    status(r) === "AIA"
      ? num(r.claim_amount)
      : COUNTED.includes(status(r))
        ? num(r.approved_amount) - num(r.total_adjust_amount)
        : 0,
  );
  return {
    claimed: sum((r) =>
      ["DRFT", "REWORK", "REJ"].includes(status(r)) ? 0 : num(r.claim_amount),
    ),
    approved: sum((r) => num(r.approved_amount)),
    refunds: sum((r) => num(r.approved_adjust_amount)),
    paid: sum((r) => num(r.paid_amount)),
    remaining:
      approvedActivities === null ||
      approvedActivities === undefined ||
      approvedActivities === ""
        ? null
        : num(approvedActivities) - counted,
  };
}

const claimsOf = async (
  context: UnitRecordContext,
  appFundId: number,
  status: string,
) =>
  items(
    claimRow,
    await claims.fundClaims({
      appFundId,
      orgId: context.user.organizationId,
      status,
    }),
  );
async function fundIn(id: string, rawFund: unknown) {
  const context = await unitRecordRead(id, "claims");
  const fund = fundOf(await appFundsOf(context), rawFund);
  return { context, appFundId: Number(fund.app_fund_id) };
}
const statusOf = (raw: string | null) =>
  /^[A-Z0-9_]{1,30}$/.test(raw ?? "") ? raw! : "";
/** Legacy row menu gates: Clone (`unit-add-claim` edit, an approved or paid claim), Delete (its delete right, a
 * new claim or a status that allows a user edit). Unusable actions are hidden. */
const rowRights = (
  context: UnitRecordContext,
  config: StatusConfig,
  r: ClaimRow,
) => {
  const role = context.access.roles.get("unit-add-claim");
  const status = text(r.claim_status_code);
  return {
    canClone: role?.edit === true && SETTLED.includes(status),
    canDelete:
      role?.delete === true &&
      (status === "" || available(config, ["CLAIM_HEADER"], status)),
  };
};

/**
 * The Claims tab's header (legacy claims-unit-claims initialize: loadAppFunds, loadLookups, loadFundSummary): the
 * application's funds (the first unless `fund` names another), the status filter, and the fund bar with the claims'
 * figures (Claimed, Approved Claims, Refunds Approved, Paid, Remaining to Claim, each behind its RB row).
 */
export async function claimsView(
  id: string,
  rawFund: string | null,
): Promise<UnitClaimsView> {
  const context = await unitRecordRead(id, "claims");
  const [rows, funds, codes] = await Promise.all([
    resources(),
    appFundsOf(context),
    lookups.codes({ types: LOOKUPS }),
  ]);
  const fund = rawFund ? fundOf(funds, rawFund) : funds[0];
  const appFundId = fund ? Number(fund.app_fund_id) : null;
  const [summary, all] =
    appFundId === null
      ? [undefined, []]
      : await Promise.all([
          claims
            .fundCategories({
              appFundId,
              orgId: context.user.organizationId,
              objectType: "CLAIM",
            })
            .then((raw) => items(summaryRowOf, raw)[0]),
          // Legacy reads the figures without an error toast: a failure leaves them empty.
          claimsOf(context, appFundId, "").catch(() => null),
        ]);
  const figures = all ? claimFigures(all, summary?.approved_amount) : null;
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const claimed: FundAmount[] = (
    [
      ["claims-claimed-amount", "Claimed", figures?.claimed],
      ["claims-approved-claims", "Approved Claims", figures?.approved],
      ["claims-refunds-approved", "Refunds Approved", figures?.refunds],
      ["claims-paid-amount", "Paid", figures?.paid],
      // Legacy colours a negative Remaining to Claim red.
      [
        "claims-remaining-to-claim",
        "Remaining to Claim",
        figures?.remaining,
        true,
      ],
    ] as FundAmount[]
  ).filter(([key]) => visible(rows, "labels", key));
  return {
    fund: fund ? text(fund.app_fund_id) : "",
    funds: funds.map((f) => ({
      value: text(f.app_fund_id),
      label: f.full_fund_display ?? f.fund_name ?? "",
    })),
    statuses: [
      { value: "", label: "All" },
      ...lookupOptions(codes, "FPCG_CLAIM_STATUS"),
    ],
    labels: {
      fund: t("labels", "claim-fund-type", "Fund Type"),
      status: t("labels", "claim-status", "Claim Status"),
    },
    ...fundBarOf(
      rows,
      codes,
      summary,
      [
        ["total-allocation", "Total Allocation", summary?.total_budget],
        ["approved-amount", "Approved Amount", summary?.approved_amount],
        ...claimed,
      ],
      ["claim"],
    ),
    tabs: [
      {
        id: "claims-summary",
        label: t("page-name", "claims-summary", "Claims Summary"),
      },
      {
        id: "claims-list",
        label: t("page-name", "claims-list", "Claims List"),
      },
    ],
    // Legacy Export: the `claims-export` row (read, fail closed) and claims on the list.
    canExport: context.access.roles.get("claims-export")?.read === true,
    add:
      context.access.roles.get("unit-add-claim")?.edit === true
        ? t("button-labels", "add-claim", "Add Claim")
        : null,
    empty: t("helper-texts", "no-data", "No data to display."),
    texts: {
      total: t("labels", "total", "Total"),
      export: t("button-labels", "export", "Export"),
      view: t("button-labels", "view", "View"),
      audits: t("button-labels", "audits", "Audits"),
      clone: t("button-labels", "clone", "Clone"),
      delete: t("button-labels", "delete", "Delete"),
      cloneTitle: t("dialog-titles", "warning", "Warning"),
      cloneMessage: t(
        "helper-texts",
        "clone-message",
        "Do you want to clone this claim?",
      ),
      cancel: t("button-labels", "cancel", "Cancel"),
      deleteTitle: t("dialog-titles", "approval-delete-warning", "Warning"),
      deleteMessage: t(
        "warning-messages",
        "approval-permanent-delete",
        "This will permanently delete the record. Do you want to continue?",
      ),
      deleteCancel: t("button-labels", "approval-delete-cancel", "Cancel"),
      deleteConfirm: t(
        "button-labels",
        "approval-confirm-delete",
        "Confirm Delete",
      ),
      details: t("page-name", "claims-details", "Claims Details"),
    },
  };
}
// The fund bar's summary row (same columns as the Activities tab's).
const summaryRowOf = z.object({
  fund_status_code: optionalText,
  total_budget: numberish,
  approved_amount: numberish,
  last_date_for_claim: optionalText,
  grant_category_name: optionalText,
  grant_value: optionalText,
  payment_account_code: optionalText,
  holding_account_code: optionalText,
  categories: z
    .array(
      z.object({
        category: optionalText,
        pending: numberish,
        review: numberish,
        approved: numberish,
        rejected: numberish,
      }),
    )
    .nullish(),
});

/** The Claims Summary table (legacy loadClaimsSummary): claimed and available by object, with column totals. */
export async function claimsSummaryView(
  id: string,
  rawFund: string | null,
): Promise<UnitClaimsSummary> {
  const { appFundId } = await fundIn(id, rawFund);
  const [rows, raw] = await Promise.all([
    resources(),
    claims.claimsSummary({ appFundId }),
  ]);
  const list = items(summaryRow, raw);
  const columns = OBJECTS.flatMap((o) => [
    `obj_${o}_claimed`,
    `obj_${o}_balance`,
  ]).concat("function_total_claimed");
  const field = (r: z.infer<typeof summaryRow>, k: string) =>
    (r as Record<string, unknown>)[k];
  return {
    headers: Object.fromEntries(
      (
        [
          ["function", "claim-function", "Function"],
          ["obj_100_claimed", "claim-salary", "Salary"],
          ["obj_100_balance", "claim-salary-available", "Salary Available"],
          ["obj_200_claimed", "claim-benefit", "Benefit"],
          ["obj_200_balance", "claim-benefit-available", "Benefit Available"],
          ["obj_300_claimed", "claim-service", "Services"],
          ["obj_300_balance", "claim-service-available", "Services Available"],
          ["obj_400_claimed", "claim-sumat", "Supplies & Materials"],
          [
            "obj_400_balance",
            "claim-sumat-available",
            "Supplies & Materials Available",
          ],
          ["obj_500_claimed", "claim-capital", "Capital"],
          ["obj_500_balance", "claim-capital-available", "Capital Available"],
          ["function_total_claimed", "claim-total", "Total"],
          ["description", "claim-function-description", "Function Description"],
        ] as const
      ).map(([k, rb, fallback]) => [k, header(rows, rb, fallback)]),
    ) as UnitClaimsSummary["headers"],
    columns,
    rows: list.map((r, i) => ({
      key: text(r.function_code) || String(i),
      function: text(r.function_code),
      description: text(r.function_description),
      amounts: Object.fromEntries(columns.map((k) => [k, amount(field(r, k))])),
    })),
    // Legacy adds a missing amount as 0.
    totals: Object.fromEntries(
      columns.map((k) => [
        k,
        list.reduce((s, r) => s + (amount(field(r, k)) ?? 0), 0),
      ]),
    ),
  };
}

/** The Claims List (legacy loadClaimsList), by status, with each claim's Clone and Delete gates. */
export async function claimsListView(
  id: string,
  rawFund: string | null,
  rawStatus: string | null,
): Promise<UnitClaimList> {
  const { context, appFundId } = await fundIn(id, rawFund);
  const [rows, list, config] = await Promise.all([
    resources(),
    claimsOf(context, appFundId, statusOf(rawStatus)),
    statusConfig().catch((): StatusConfig => ({})),
  ]);
  return {
    headers: Object.fromEntries(
      (
        [
          ["number", "claim-number", "Claim Number"],
          ["date", "claim-date", "Claim Date"],
          ["status", "claim-status", "Status"],
          ["paidDate", "claim-paid-date", "Paid Date"],
          ["po", "claim-po-number", "PO Number"],
          ["period", "claim-period", "Period"],
          ["amount", "claim-amount", "Claim Amount"],
          ["approved", "claim-approved", "Approved"],
          ["lines", "claim-lines", "Lines"],
          ["rejected", "claim-rejected", "Rejected"],
          ["adjustments", "claim-adjustments", "Adjustments"],
        ] as const
      ).map(([k, rb, fallback]) => [k, header(rows, rb, fallback)]),
    ) as UnitClaimList["headers"],
    rows: list.map((r) => ({
      key: text(r.claim_id),
      number: text(r.claim_number),
      date: text(r.claim_date),
      status: text(r.claim_status_descr),
      paidDate: text(r.paid_date),
      po: text(r.po_number),
      period: text(r.claim_period_month_name),
      amount: amount(r.claim_amount),
      approved: amount(r.approved_amount),
      lines: text(r.claim_line_count),
      rejected: text(r.rejected_line_count),
      adjustments: text(r.adjustment_count),
      ...rowRights(context, config, r),
    })),
  };
}

const claimInput = z
  .object({
    fund: z.string().regex(/^\d{1,15}$/),
    claim: z.string().regex(/^\d{1,15}$/),
  })
  .strict();
/** The fund's claim, with its row gates; refused when it is not one of the fund's claims. */
export async function claimOf(id: string, raw: unknown) {
  const parsed = claimInput.safeParse(raw);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid claim.", 400);
  const { context, appFundId } = await fundIn(id, parsed.data.fund);
  const [list, config] = await Promise.all([
    claimsOf(context, appFundId, ""),
    statusConfig(),
  ]);
  const row = list.find((r) => text(r.claim_id) === parsed.data.claim);
  if (!row)
    throw new AppError("FORBIDDEN", "This claim is not on the fund.", 403);
  return { context, row, rights: rowRights(context, config, row) };
}
/** WRITES: a copy of an approved or paid claim (legacy cloneClaim, postClaimsClone). */
export async function cloneClaim(id: string, raw: unknown) {
  const { row, rights } = await claimOf(id, raw);
  if (!rights.canClone)
    throw new AppError("FORBIDDEN", "This claim cannot be cloned.", 403);
  await claims.cloneClaim({ claimId: Number(row.claim_id) });
  return { cloned: true as const };
}
/** WRITES: removes a claim (legacy deleteClaim, deleteFundClaims). */
export async function deleteClaim(id: string, raw: unknown) {
  const { row, rights } = await claimOf(id, raw);
  if (!rights.canDelete)
    throw new AppError("FORBIDDEN", "This claim cannot be deleted.", 403);
  await claims.deleteClaim({ claimId: Number(row.claim_id) });
  return { deleted: true as const };
}

/** WRITES (generate-report): the Claims List as legacy exports it (report-vbcs-claim-header-listing). */
export async function exportClaims(id: string, raw: unknown) {
  const parsed = z
    .object({ fund: z.string().regex(/^\d{1,15}$/), status: z.string() })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid export.", 400);
  const { context, appFundId } = await fundIn(id, parsed.data.fund);
  if (context.access.roles.get("claims-export")?.read !== true)
    throw new AppError("FORBIDDEN", "You do not have access to export.", 403);
  return reports.generate({
    body: serverFunctions.reports.reportPayload(
      "report-vbcs-claim-header-listing",
      {
        object_type: "CLAIMS",
        object_id: Number(id),
        org_id: context.user.organizationId,
        app_fund_id: appFundId,
        line_status_code: statusOf(parsed.data.status),
      },
    ),
  });
}

/** The audit trail's scope for a claim (legacy loadAuditTrail HEADER): the claim, when one of the application's funds has it. */
export async function claimAuditScope(id: string, sec: string | undefined) {
  if (!/^\d{1,15}$/.test(sec ?? ""))
    throw new AppError("BAD_REQUEST", "Invalid audit scope.", 400);
  const context = await unitRecordRead(id, "claims");
  const funds = await appFundsOf(context);
  const lists = await Promise.all(
    funds.map((f) => claimsOf(context, Number(f.app_fund_id), "")),
  );
  if (!lists.flat().some((r) => text(r.claim_id) === sec))
    throw new AppError(
      "FORBIDDEN",
      "This claim is not on the application.",
      403,
    );
  return { context, claimId: sec! };
}

const headerRow = z.object({
  claim_id: numberish,
  claim_number: optionalText,
  full_fund_display: optionalText,
  claim_period_code: numberish,
  claim_status_code: optionalText,
  claim_status_descr: optionalText,
  submitted_on: optionalText,
  paid_date: optionalText,
  claim_amount: numberish,
  approved_amount: numberish,
  paid_amount: numberish,
  adjust_amount: numberish,
  approved_adjust_amount: numberish,
});
export const lineRow = z.object({
  claim_line_id: numberish,
  line_no: numberish,
  position_type_code: optionalText,
  position_type_descr: optionalText,
  function_code: optionalText,
  function_code_descr: optionalText,
  object_code: optionalText,
  object_code_descr: optionalText,
  expenditure_activity_id: numberish,
  expenditure_descr: optionalText,
  amend_version_id: numberish,
  fte_code: optionalText,
  category_code: optionalText,
  category_descr: optionalText,
  category_item_id: numberish,
  roster_id: numberish,
  roster_name: optionalText,
  paid_to_company: optionalText,
  expenditure_amount: numberish,
  adjust_amount: numberish,
  line_status_code: optionalText,
  line_status_descr: optionalText,
  defer_payment: optionalText,
  cohort: optionalText,
  start_date: optionalText,
  end_date: optionalText,
  transaction_date: optionalText,
  transaction_no: optionalText,
  reviewer_comment: optionalText,
});
/** Legacy getClaimPeriods: the twelve months, `value` 1–12. */
const MONTHS = moment.localeData("en").months();
/** A claim's header and lines, refused when the claim is not the fund's. */
export async function claimRecord(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
) {
  const { context, row } = await claimOf(id, {
    fund: rawFund,
    claim: rawClaim,
  });
  const claimId = Number(row.claim_id);
  const [head, lines, stages, config] = await Promise.all([
    claims.fundClaim({ claimId }).then((raw) => items(headerRow, raw)[0]),
    claims.claimLines({ claimId }).then((raw) => items(lineRow, raw)),
    approvals.stages({ docNum: String(claimId), docType: "CLAIM_HEADER" }),
    statusConfig(),
  ]);
  return { context, row, head, lines, stages, config };
}
/** Legacy: the claim is open to change while new, or in a status that allows a user edit (header or adjustment). */
export const claimOpen = (config: StatusConfig, status: string) =>
  status === "" ||
  available(config, ["CLAIM_HEADER", "CLAIM_ADJUSTMENT_HEADER"], status);

/**
 * One claim in the side panel (legacy viewClaimDetails → loadClaimLines, fetchApprovalStages): the header fields it
 * has, its lines with their row gates, Export, and the route's document for the shared approvals.
 */
export async function claimView(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
): Promise<UnitClaimView> {
  const [rows, record, codes] = await Promise.all([
    resources(),
    claimRecord(id, rawFund, rawClaim),
    lookups.codes({ types: "FPCG_COHORT" }),
  ]);
  const { context, head, lines, stages, config } = record;
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const cohorts = lookupOptions(codes, "FPCG_COHORT");
  const h = head ?? ({} as z.infer<typeof headerRow>);
  const fields: UnitClaimView["fields"] = [];
  const add = (
    key: string,
    fallback: string,
    value: string,
    kind: "text" | "date" | "money" = "text",
  ) => {
    if (value !== "")
      fields.push({ key, label: t("labels", key, fallback), value, kind });
  };
  add("claim-number", "Claim Number", text(h.claim_number));
  add("claim-fund", "Fund", text(h.full_fund_display));
  const period = Number(h.claim_period_code);
  add(
    "claim-period",
    "Claim Period",
    period >= 1 && period <= 12 ? MONTHS[period - 1] : "",
  );
  if (text(h.claim_status_code))
    add("claim-status", "Status", text(h.claim_status_descr));
  add("claim-submission-date", "Submission Date", text(h.submitted_on), "date");
  add("claim-paid-date", "Paid Date", text(h.paid_date), "date");
  for (const [key, fallback, v] of [
    ["claim-amount", "Claim Amount", h.claim_amount],
    ["claim-approved-amount", "Approved Amount", h.approved_amount],
    ["claim-paid-amount", "Paid Amount", h.paid_amount],
    ["claim-adjust-amount", "Adjust Amount", h.adjust_amount],
    [
      "claim-approved-adjust-amount",
      "Approved Adjust Amount",
      h.approved_adjust_amount,
    ],
  ] as const)
    if (amount(v) !== null) add(key, fallback, String(amount(v)), "money");
  const routed = stages.length > 0;
  return {
    key: text(record.row.claim_id),
    adjustable: ADJUSTABLE.includes(text(record.row.claim_status_code)),
    fields,
    canExport: context.access.roles.get("claims-export")?.read === true,
    headers: Object.fromEntries(
      (
        [
          ["number", "claim-line-number", "No"],
          ["positionType", "claim-line-position-type", "Position Type"],
          ["function", "claim-line-function", "Function"],
          ["object", "claim-line-object", "Object"],
          ["expenditure", "claim-line-exp-descr", "Expenditure Description"],
          ["category", "claim-line-category", "Category"],
          ["person", "claim-line-person", "Person / Company"],
          ["amount", "claim-line-exp-amount", "Expenditure Amount"],
          ["adjust", "claim-line-adj-amount", "Adjust Amount"],
          ["status", "claim-line-status", "Status"],
          ["defer", "claim-line-defer", "Defer Payment"],
          ["cohort", "claim-line-cohort", "Cohort"],
          ["start", "claim-line-start-date", "Start Date"],
          ["end", "claim-line-end-date", "End Date"],
          ["transDate", "claim-line-trans-date", "Transaction Date"],
          ["transNo", "claim-line-trans-num", "Transaction Number"],
          ["comments", "claim-line-reviewer-comments", "Reviewer Comments"],
        ] as const
      ).map(([k, rb, fallback]) => [k, header(rows, rb, fallback)]),
    ) as UnitClaimView["headers"],
    lines: lines.map((l) => {
      const position = text(l.position_type_code) === "POSITION";
      const status = text(l.line_status_code);
      return {
        key: text(l.claim_line_id),
        number: text(l.line_no),
        positionType: text(l.position_type_descr),
        function: text(l.function_code_descr),
        object: text(l.object_code_descr),
        expenditure: text(l.expenditure_descr),
        category: text(l.category_descr),
        person: position ? text(l.roster_name) : text(l.paid_to_company),
        amount: amount(l.expenditure_amount),
        adjust: amount(l.adjust_amount),
        status: text(l.line_status_descr),
        defer: text(l.defer_payment) === "Y",
        cohort:
          cohorts.find((c) => c.value === text(l.cohort))?.label ??
          text(l.cohort),
        start: text(l.start_date),
        end: text(l.end_date),
        transDate: text(l.transaction_date),
        transNo: text(l.transaction_no),
        comments: text(l.reviewer_comment),
        // Legacy Claimable Amounts: a position line that is not a lump sum (fte 2).
        activity:
          position &&
          text(l.fte_code) !== "2" &&
          text(l.expenditure_activity_id)
            ? {
                activity: text(l.expenditure_activity_id),
                version: text(l.amend_version_id),
              }
            : null,
        // Legacy line Approvals: once the claim is routed, or the line is past a user edit.
        approvals:
          routed || status === "" || !available(config, ["CLAIM_LINE"], status),
      };
    }),
    texts: {
      title: t("page-name", "claims-details", "Claims Details"),
      audits: t("button-labels", "audits", "Audits"),
      amounts: t("button-labels", "claimable-amounts", "Claimable Amounts"),
      approvals: t("button-labels", "approvals", "Approvals"),
      approvalTitle: t("dialog-titles", "approval-details", "Approval Details"),
      export: t("button-labels", "export", "Export"),
      empty: t("helper-texts", "no-data", "No data to display."),
      yes: t("option-keys", "yes", "Yes"),
      no: t("option-keys", "no", "No"),
    },
  };
}

/** WRITES (generate-report): one claim's lines (legacy report-vbcs-claim-lines-listing). */
export async function exportClaimLines(id: string, raw: unknown) {
  const parsed = z
    .object({ fund: z.string(), claim: z.string(), status: z.string() })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid export.", 400);
  const { context, row } = await claimOf(id, {
    fund: parsed.data.fund,
    claim: parsed.data.claim,
  });
  if (context.access.roles.get("claims-export")?.read !== true)
    throw new AppError("FORBIDDEN", "You do not have access to export.", 403);
  return reports.generate({
    body: serverFunctions.reports.reportPayload(
      "report-vbcs-claim-lines-listing",
      {
        object_type: "CLAIMS",
        object_id: Number(row.claim_id),
        org_id: context.user.organizationId,
        app_fund_id: Number(parsed.data.fund),
        line_status_code: statusOf(parsed.data.status),
      },
    ),
  });
}

/** A claim line's audit scope (legacy loadAuditTrail LINE): the line, when it is on a claim of the application. */
export async function claimLineAuditScope(
  id: string,
  claim: string,
  line: string | undefined,
) {
  if (!/^\d{1,15}$/.test(line ?? ""))
    throw new AppError("BAD_REQUEST", "Invalid audit scope.", 400);
  const { context } = await claimAuditScope(id, claim);
  const lines = items(
    lineRow,
    await claims.claimLines({ claimId: Number(claim) }),
  );
  if (!lines.some((l) => text(l.claim_line_id) === line))
    throw new AppError("FORBIDDEN", "This line is not on the claim.", 403);
  return { context, claimId: line! };
}

// ── Claim editor (legacy claim drawer in create / edit: the line dialog, rejected lines, Save Claim) ──
const catRow = z.object({
  category_code: optionalText,
  category_descr: optionalText,
  item_id: numberish,
});
const personRow = z.object({ roster_id: numberish, roster_name: optionalText });
const jobRow = z.object({
  activity_id: numberish,
  expenditure_descr: optionalText,
  amend_version_id: numberish,
  fte_code: optionalText,
  activity_categories: z.array(catRow).nullish(),
  roster_personnels: z.array(personRow).nullish(),
});
const objectRow = z.object({
  object_code: optionalText,
  object_code_descr: optionalText,
  activity_job_titles: z.array(jobRow).nullish(),
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
/** The picker's tree (legacy loadActivityHierarchy / createHierarchyLookup), codes and labels only. */
async function hierarchyOf(appFundId: number): Promise<ClaimHierarchy[]> {
  return items(typeRow, await claims.activityHierarchy({ appFundId })).map(
    (t) => ({
      value: text(t.activity_type_code),
      label: text(t.activity_type_descr),
      functions: (t.function_codes ?? []).map((f) => ({
        value: text(f.function_code),
        label: text(f.function_code_descr),
        objects: (f.object_codes ?? []).map((o) => ({
          value: text(o.object_code),
          label: text(o.object_code_descr),
          jobs: (o.activity_job_titles ?? []).map((j) => ({
            value: text(j.activity_id),
            label: text(j.expenditure_descr),
            version: text(j.amend_version_id),
            fte: text(j.fte_code),
            categories: (j.activity_categories ?? []).map((c) => ({
              value: text(c.category_code),
              label: text(c.category_descr),
              item: text(c.item_id),
            })),
            people: (j.roster_personnels ?? []).map((p) => ({
              value: text(p.roster_id),
              label: text(p.roster_name),
            })),
          })),
        })),
      })),
    }),
  );
}
const dateOnly = (v: unknown) => text(v).slice(0, 10);
function draftOf(
  l: z.infer<typeof lineRow>,
  editable: boolean,
  rejected = false,
): ClaimLineDraft {
  return {
    key: text(l.claim_line_id),
    lineId: text(l.claim_line_id),
    lineNo: text(l.line_no),
    positionType: text(l.position_type_code),
    positionTypeLabel: text(l.position_type_descr),
    function: text(l.function_code),
    functionLabel: text(l.function_code_descr),
    object: text(l.object_code),
    objectLabel: text(l.object_code_descr),
    activity: text(l.expenditure_activity_id),
    version: text(l.amend_version_id),
    fte: text(l.fte_code),
    expenditure: text(l.expenditure_descr),
    category: text(l.category_code),
    categoryLabel: text(l.category_descr),
    categoryItem: text(l.category_item_id),
    roster: text(l.roster_id),
    rosterLabel: text(l.roster_name),
    company: text(l.paid_to_company),
    amount:
      amount(l.expenditure_amount) === null
        ? ""
        : String(amount(l.expenditure_amount)),
    defer: text(l.defer_payment) === "Y" ? "Y" : "N",
    start: dateOnly(l.start_date),
    end: dateOnly(l.end_date),
    transNo: text(l.transaction_no),
    transDate: dateOnly(l.transaction_date),
    cohort: text(l.cohort),
    status: text(l.line_status_code),
    statusLabel: text(l.line_status_descr),
    adjust: amount(l.adjust_amount),
    comments: text(l.reviewer_comment),
    rejected,
    editable,
  };
}
/** Legacy line Edit / Delete: no route, a claim open in its header status, and a line that is new, rejected or open. */
const lineOpen = (
  config: StatusConfig,
  routed: boolean,
  claimStatus: string,
  lineStatus: string,
) =>
  !routed &&
  (claimStatus === "" || available(config, ["CLAIM_HEADER"], claimStatus)) &&
  (lineStatus === "" ||
    lineStatus === "REJ" ||
    available(config, ["CLAIM_LINE"], lineStatus));
async function periodContext(context: UnitRecordContext) {
  const [summary, globals] = await Promise.all([
    appSummaryOf(context),
    globalVariables(),
  ]);
  const start = globals.find(
    (g) => g.var_key === "ACADEMIC_YEAR_MONTH",
  )?.var_value;
  return {
    fy: text((summary as { fy_code?: unknown }).fy_code),
    // Legacy: ACADEMIC_YEAR_MONTH || 'JAN'.
    startMonth: text(start) || "JAN",
  };
}

/** What Save Claim and the editor share: the claim's gates, its lines as drafts, the fund's tree and the period. */
async function editState(id: string, rawFund: unknown, rawClaim: unknown) {
  const isNew = rawClaim === "" || rawClaim === null || rawClaim === undefined;
  const base = isNew
    ? await (async () => {
        const { context, appFundId } = await fundIn(id, rawFund);
        return {
          context,
          appFundId,
          head: undefined,
          lines: [] as z.infer<typeof lineRow>[],
          routed: false,
          config: await statusConfig(),
        };
      })()
    : await (async () => {
        const r = await claimRecord(id, rawFund, rawClaim);
        return {
          context: r.context,
          appFundId: Number(rawFund),
          head: r.head,
          lines: r.lines,
          routed: r.stages.length > 0,
          config: r.config,
        };
      })();
  const { context, appFundId, head, lines, routed, config } = base;
  const [hierarchy, period] = await Promise.all([
    hierarchyOf(appFundId),
    periodContext(context),
  ]);
  const role = context.access.roles.get("unit-add-claim");
  const claimStatus = text(head?.claim_status_code);
  return {
    context,
    appFundId,
    canEdit: role?.edit === true,
    open: !routed && claimOpen(config, claimStatus),
    canDeleteLines: role?.delete === true,
    period: isNew
      ? String(monthOf(period.startMonth) ?? 1)
      : text(head?.claim_period_code),
    hierarchy,
    fy: period.fy,
    startMonth: period.startMonth,
    lines: lines.map((l) =>
      draftOf(
        l,
        lineOpen(config, routed, claimStatus, text(l.line_status_code)),
      ),
    ),
  };
}

/**
 * The claim editor's setup (legacy addNewClaim / viewClaimDetails in edit): the picker's tree, periods and cohorts,
 * the claim's lines as drafts with their Edit / Delete gates, and whether the claim may change at all.
 */
export async function claimEditView(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
): Promise<UnitClaimEditView> {
  const [state, rows, codes] = await Promise.all([
    editState(id, rawFund, rawClaim),
    resources(),
    lookups.codes({ types: "FPCG_COHORT" }),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    ...omit(state, ["context", "appFundId"]),
    periods: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
    cohorts: lookupOptions(codes, "FPCG_COHORT"),
    labels: Object.fromEntries(
      (
        [
          ["claim-period", "Claim Period"],
          ["claim-position-type", "Position Type"],
          ["claim-function", "Function"],
          ["claim-object", "Object"],
          ["claim-exp-descr", "Expenditure Description"],
          ["claim-category", "Category"],
          ["claim-person", "Person / Company"],
          ["claim-exp-amount", "Expenditure Amount"],
          ["claim-defer", "Defer Payment"],
          ["claim-start-date", "Start Date"],
          ["claim-end-date", "End Date"],
          ["claim-trans-num", "Transaction Number"],
          ["claim-trans-date", "Transaction Date"],
          ["claim-cohort", "Cohort"],
          ["claim-status", "Status"],
        ] as const
      ).map(([k, fallback]) => [k, t("labels", k, fallback)]),
    ),
    texts: {
      addLine: t("button-labels", "add-new-claim", "Add New Claim"),
      addRejected: t(
        "button-labels",
        "add-rejected-claim",
        "Add Rejected Claim",
      ),
      save: t("button-labels", "save-claim", "Save Claim"),
      lineTitle: t("dialog-titles", "claim-line-details", "Claim Line Details"),
      submit: t("button-labels", "submit", "Submit"),
      edit: t("button-labels", "edit", "Edit"),
      delete: t("button-labels", "delete", "Delete"),
      yes: t("option-keys", "yes", "Yes"),
      no: t("option-keys", "no", "No"),
      // Legacy addRejectedClaimLines' literal toast.
      alreadyExist: "Already Exist",
      period: t("labels", "claim-period", "Claim Period"),
      empty: t("helper-texts", "no-data", "No data to display."),
    },
  };
}

/** The fund's rejected lines for a period (legacy loadRejectedClaimLines), as drafts to bring into the claim. */
export async function rejectedLinesView(
  id: string,
  rawFund: unknown,
  rawPeriod: unknown,
  rawClaim: unknown,
): Promise<UnitRejectedLines> {
  const period = monthOf(text(rawPeriod));
  if (period === null)
    throw new AppError("BAD_REQUEST", "Invalid claim period.", 400);
  const claimId =
    rawClaim && /^\d{1,15}$/.test(text(rawClaim))
      ? Number(
          (await claimOf(id, { fund: rawFund, claim: rawClaim })).row.claim_id,
        )
      : undefined;
  const { appFundId } = await fundIn(id, rawFund);
  const rows = items(
    lineRow,
    await claims.rejectedLines({ appFundId, period, claimId }),
  );
  return { lines: rows.map((l) => draftOf(l, true, true)) };
}

const field = (max: number) => z.string().max(max);
const draftInput = z
  .object({
    lineId: z.union([z.literal(""), z.string().regex(/^\d{1,15}$/)]),
    positionType: field(30),
    function: field(30),
    object: field(30),
    activity: field(15),
    version: field(15),
    expenditure: field(2000),
    category: field(60),
    categoryItem: field(15),
    roster: field(15),
    company: field(240),
    amount: field(30),
    defer: z.enum(["Y", "N"]),
    start: field(10),
    end: field(10),
    transNo: field(100),
    transDate: field(10),
    cohort: field(30),
    rejected: z.boolean(),
  })
  .strict();
const saveInput = z
  .object({
    fund: z.string().regex(/^\d{1,15}$/),
    claim: z.union([z.literal(""), z.string().regex(/^\d{1,15}$/)]),
    period: z.coerce.number().int().min(1).max(12),
    lines: z.array(draftInput).max(500),
  })
  .strict();
const required = (message: string) => new AppError("BAD_REQUEST", message, 400);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** One line's write pick (legacy saveClaim sends the whole row; here only the fields a line holds). */
function linePick(d: z.infer<typeof draftInput>, lineNo: string) {
  const position = d.positionType === "POSITION";
  const num = (v: string) => (v === "" ? null : Number(v));
  return {
    claim_line_id: num(d.lineId),
    line_no: d.lineId && lineNo !== "" ? Number(lineNo) : null,
    position_type_code: d.positionType,
    function_code: d.function,
    object_code: d.object,
    expenditure_activity_id: position ? num(d.activity) : null,
    amend_version_id: position ? num(d.version) : null,
    // Legacy sends the description under both names.
    expenditure_descr: d.expenditure,
    expenditure_desc: d.expenditure,
    category_code: position && d.category ? d.category : null,
    category_item_id: position && d.category ? num(d.categoryItem) : null,
    roster_id: position ? num(d.roster) : null,
    paid_to_roster_id: position ? num(d.roster) : null,
    paid_to_company: position ? null : d.company,
    expenditure_amount: d.amount === "" ? null : Number(d.amount),
    defer_payment: d.defer,
    start_date: d.category ? d.start : null,
    end_date: d.category ? d.end : null,
    transaction_no: d.transNo,
    transaction_date: d.transDate,
    cohort: d.cohort || null,
    ...(d.rejected
      ? {
          adj_type_code: "REJECT",
          from_function_code: d.function,
          from_object_code: d.object,
          refund_amount: 0,
        }
      : {}),
  };
}
/** Legacy vgClaimLine's required fields and the picker's codes, checked against the fund's tree. */
function checkLine(
  d: z.infer<typeof draftInput>,
  tree: ClaimHierarchy[],
  range: { start: string; end: string } | null,
) {
  const fill = "Please fill all the required fields!";
  const type = tree.find((x) => x.value === d.positionType);
  const fn = type?.functions.find((x) => x.value === d.function);
  const obj = fn?.objects.find((x) => x.value === d.object);
  if (!type || !fn || !obj) throw required(fill);
  if (d.positionType === "POSITION") {
    const job = obj.jobs.find((x) => x.value === d.activity);
    if (!job || job.version !== d.version) throw required(fill);
    if (!job.people.some((p) => p.value === d.roster)) throw required(fill);
    if (
      d.category &&
      !job.categories.some(
        (c) => c.value === d.category && c.item === d.categoryItem,
      )
    )
      throw required(fill);
  } else if (!d.expenditure.trim() || !d.company.trim()) throw required(fill);
  if (!d.transNo.trim() || !ISO.test(d.transDate)) throw required(fill);
  if (d.category && (!ISO.test(d.start) || !ISO.test(d.end)))
    throw required(fill);
  if (d.amount !== "" && !Number.isFinite(Number(d.amount)))
    throw required(fill);
  // Legacy's transaction date validator, messages verbatim.
  if (range && d.transDate > range.end)
    throw required(`Transaction Date cannot be later than ${range.end}.`);
  if (range && d.transDate < range.start)
    throw required(`Transaction Date cannot be earlier than ${range.start}.`);
}

/**
 * WRITES: Save Claim (legacy saveClaim: postFundClaims / putClaim with the period and every line). The claim must be
 * open (no route, a status that allows a user edit) and the user hold `unit-add-claim` edit. Lines the user may not
 * change are sent as stored; a line that is not the claim's must be one of the fund's rejected lines for the period;
 * every other line is checked against the fund's activity tree.
 */
export async function saveClaim(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) throw required("Please fill all the required fields!");
  const input = parsed.data;
  const view = await editState(id, input.fund, input.claim);
  if (!view.canEdit || !view.open)
    throw new AppError("FORBIDDEN", "This claim cannot be changed.", 403);
  const appFundId = Number(input.fund);
  const tree = view.hierarchy;
  const rejected = items(
    lineRow,
    await claims.rejectedLines({
      appFundId,
      period: input.period,
      claimId: input.claim ? Number(input.claim) : undefined,
    }),
  );
  const range = claimPeriodRange(view.fy, input.period, view.startMonth);
  const stored = new Map(view.lines.map((l) => [l.lineId, l]));
  const lines = input.lines.map((d) => {
    const saved = d.lineId ? stored.get(d.lineId) : undefined;
    if (saved && !saved.editable)
      return linePick(draftInput.parse(asInput(saved)), saved.lineNo);
    const back = d.lineId
      ? rejected.find((r) => text(r.claim_line_id) === d.lineId)
      : undefined;
    if (d.lineId && !saved && !back)
      throw new AppError("FORBIDDEN", "This line is not on the claim.", 403);
    checkLine(d, tree, range);
    // Legacy keeps a saved or brought-back line's number; a new line has none.
    return linePick(
      { ...d, rejected: d.rejected || back !== undefined },
      saved?.lineNo ?? text(back?.line_no),
    );
  });
  const body = { claim_period_code: input.period, claim_lines: lines };
  if (input.claim) {
    await claims.updateClaim({ claimId: Number(input.claim), body });
    return { claim: input.claim };
  }
  const reply = await claims.createClaim({ appFundId, body });
  const minted = items(z.object({ claim_id: numberish }), reply)[0]?.claim_id;
  if (minted === null || minted === undefined)
    throw new AppError("CONTRACT", "The claim was not created.");
  return { claim: text(minted) };
}
const asInput = (l: ClaimLineDraft) => ({
  lineId: l.lineId,
  positionType: l.positionType,
  function: l.function,
  object: l.object,
  activity: l.activity,
  version: l.version,
  expenditure: l.expenditure,
  category: l.category,
  categoryItem: l.categoryItem,
  roster: l.roster,
  company: l.company,
  amount: l.amount,
  defer: l.defer,
  start: l.start,
  end: l.end,
  transNo: l.transNo,
  transDate: l.transDate,
  cohort: l.cohort,
  rejected: l.rejected,
});
