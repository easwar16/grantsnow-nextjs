import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import type {
  UnitFundColumn,
  UnitHeading,
  UnitSummaryField,
  UnitSummaryView,
} from "@/features/modules/claims/units/types";
import { signOffViews, type SignOffView } from "@/shared/claims/unit-record";
import { BUNDLE, label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appSummaryOf, type AppSummaryRow } from "./shell";
import { canAllocate } from "./allocations";
import { statusConfig, type StatusConfig } from "./status";

const text = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);
const amount = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const heading = (
  rows: Resources,
  key: string,
  fallback: string,
): UnitHeading => ({
  title: label(rows, "header-labels", key, fallback),
  help: serverFunctions.resources.resourceDescription(
    rows,
    BUNDLE,
    "header-labels",
    key,
  ),
});

const fundRow = z.object({
  app_fund_id: numberish,
  full_fund_display: optionalText,
  fund_status_code: optionalText,
  fund_status_value: optionalText,
  original_allocation: numberish,
  day20_adjustment: numberish,
  other_adjustments: numberish,
  total_budget: numberish,
  unapplied_balance: numberish,
  pending_allocation: numberish,
  grant_period: optionalText,
  last_date_for_amendment: optionalText,
  last_date_for_claim: optionalText,
});
const FUND_HEADERS: Record<UnitFundColumn, [string, string]> = {
  fund: ["summary-grant", "Grant/CFDA"],
  status: ["summary-status", "Status"],
  original: ["summary-original-allocations", "Original Allocations"],
  day20: ["summary-20-day-adjustments", "20th Day Adjustments"],
  other: ["summary-other-adjustments", "Other Adjustments"],
  budget: ["summary-total-budget", "Total Budget"],
  unapplied: ["summary-unapplied-balance", "Unapplied Balance"],
  pending: ["summary-pending-allocations", "Pending Allocations"],
  period: ["summary-grant-period", "Grant Period"],
  amendmentDate: ["summary-amendment-date", "Amendment Date"],
  claimDate: ["summary-claim-date", "Claim Date"],
  allocation: ["summary-allocation", "Allocations"],
};

/** The Fund Summary table (legacy loadFundSummary): the funds and summaryTotals (null adds 0, as `?? 0`). */
async function fundSummary(
  context: UnitRecordContext,
  rows: Resources,
  config: StatusConfig,
) {
  const items = z.object({ items: z.array(fundRow) }).parse(
    await claims.appFundSummary({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  ).items;
  const mapped = items.map((r, i) => {
    // Legacy getPeriod: "start~~end", each part formatted and joined with " - " (an empty "~~" shows " - ").
    const [start = "", end = ""] = (r.grant_period ?? "").split("~~");
    return {
      key: text(r.app_fund_id) || String(i),
      fund: r.full_fund_display ?? "",
      status: r.fund_status_value ?? "",
      original: amount(r.original_allocation),
      day20: amount(r.day20_adjustment),
      other: amount(r.other_adjustments),
      budget: amount(r.total_budget),
      unapplied: amount(r.unapplied_balance),
      pending: amount(r.pending_allocation),
      period:
        r.grant_period === null || r.grant_period === undefined
          ? null
          : ([start, end] as [string, string]),
      amendmentDate: r.last_date_for_amendment ?? "",
      claimDate: r.last_date_for_claim ?? "",
      allocate: canAllocate(context, config, r.fund_status_code),
    };
  });
  const sum = (
    k: "original" | "day20" | "other" | "budget" | "unapplied" | "pending",
  ) => mapped.reduce((total, r) => total + (r[k] ?? 0), 0);
  return {
    ...heading(rows, "unit-fund-summary", "Fund Summary"),
    headers: Object.fromEntries(
      Object.entries(FUND_HEADERS).map(([k, [key, fallback]]) => [
        k,
        label(rows, "table-headers", key, fallback),
      ]),
    ) as Record<UnitFundColumn, string>,
    rows: mapped,
    totals: {
      original: sum("original"),
      day20: sum("day20"),
      other: sum("other"),
      budget: sum("budget"),
      unapplied: sum("unapplied"),
      pending: sum("pending"),
    },
    totalLabel: label(rows, "labels", "total", "Total"),
    // Legacy's Fund Summary empty state is the literal "No Data".
    empty: "No Data",
  };
}

/**
 * The application's people and sign-off fields (legacy vgPersonDetails, vgAdminDetails): RB key, fallback, the
 * app-summary column, a date. Every one is required in edit mode; Network Chief exists only for a CONTRACT unit.
 */
const PEOPLE = {
  preparer: [
    ["program-preparer-name", "Name", "program_preparer_name"],
    ["program-preparer-title", "Title", "program_preparer_title"],
    ["program-preparer-email", "Email", "program_preparer_email"],
    ["program-preparer-phone", "Phone", "program_preparer_phone"],
  ],
  cfo: [
    ["controller-name", "Name", "cfo_controller_name"],
    ["controller-email", "Email", "cfo_controller_email"],
    ["controller-phone", "Phone", "cfo_controller_phone"],
  ],
  signedOff: [
    ["school-admin", "School Administrator", "school_admin_name"],
    [
      "school-admin-sign-date",
      "School Administrator Signature Date",
      "school_admin_sign_date",
      true,
    ],
    ["board-member", "Governing Board Member", "board_member_name"],
    [
      "board-member-sign-date",
      "Governing Board Member Signature Date",
      "board_member_sign_date",
      true,
    ],
    ["parent-representative", "Parent Representative", "parent_rep_name"],
    [
      "parent-representative-sign-date",
      "Parent Representative Signature Date",
      "parent_rep_sign_date",
      true,
    ],
    ["network-chief", "Network Chief", "network_chief_name"],
  ],
} as const satisfies Record<
  string,
  readonly (
    | readonly [string, string, EditableColumn]
    | readonly [string, string, EditableColumn, true]
  )[]
>;
type EditableColumn = (typeof EDITABLE)[number];
/** The columns Save may change; everything else in the body is the row as read. */
export const EDITABLE = [
  "program_preparer_name",
  "program_preparer_title",
  "program_preparer_email",
  "program_preparer_phone",
  "cfo_controller_name",
  "cfo_controller_email",
  "cfo_controller_phone",
  "school_admin_name",
  "school_admin_sign_date",
  "board_member_name",
  "board_member_sign_date",
  "parent_rep_name",
  "parent_rep_sign_date",
  "network_chief_name",
] as const;
const DATE_COLUMNS = new Set<string>(
  Object.values(PEOPLE).flatMap((group) =>
    group.flatMap((f) => (f.length === 4 ? [f[2]] : [])),
  ),
);
/** The fields this unit shows: Network Chief only for a CONTRACT unit (legacy oj-bind-if). */
const shownFields = (s: AppSummaryRow, group: keyof typeof PEOPLE) =>
  PEOPLE[group].filter(
    (f) => f[2] !== "network_chief_name" || s.unit_category === "CONTRACT",
  );
function signOffFields(s: AppSummaryRow, rows: Resources) {
  const fields = (group: keyof typeof PEOPLE): UnitSummaryField[] =>
    shownFields(s, group).map((f) => ({
      key: f[0],
      column: f[2],
      label: label(rows, "labels", f[0], f[1]),
      value: text(s[f[2]]),
      ...(f.length === 4 ? { date: true } : {}),
    }));
  return {
    preparer: fields("preparer"),
    cfo: fields("cfo"),
    signedOff: fields("signedOff"),
  };
}

const SIGN_OFF_TABS: Record<SignOffView, [string, string]> = {
  stakeholders: ["stakeholders-list", "Consultation Stakeholder List"],
  meetings: ["meeting-sheet", "Consultation Meeting Sign-In Sheet"],
  documents: ["org-chart", "Org Chart"],
};
const description = (rows: Resources, key: string) =>
  serverFunctions.resources.resourceDescription(
    rows,
    BUNDLE,
    "description",
    key,
  );

const auditLabel = (rows: Resources, key: string, fallback: string) =>
  serverFunctions.resources.resourceVisible(rows, BUNDLE, "button-labels", key)
    ? label(rows, "button-labels", key, fallback)
    : null;

/** The Summary tab (legacy claims-unit-summary initialize): the funds and the application read side by side. */
export async function unitSummaryView(id: string): Promise<UnitSummaryView> {
  const context = await unitRecordRead(id, "summary");
  const rowsRead = resources();
  // Without the status config the Allocations buttons stay disabled (fail closed); the summary still shows.
  const configRead = statusConfig().catch((): StatusConfig => ({}));
  const [rows, summary, funds] = await Promise.all([
    rowsRead,
    appSummaryOf(context),
    Promise.all([rowsRead, configRead]).then(([r, c]) =>
      fundSummary(context, r, c),
    ),
  ]);
  const fields = signOffFields(summary, rows);
  return {
    fundSummary: funds,
    preparer: {
      ...heading(rows, "unit-program-preparer", "Program Preparer"),
      fields: fields.preparer,
    },
    cfo: {
      ...heading(rows, "unit-cfo-controller", "CFO or Controller"),
      fields: fields.cfo,
    },
    signedOff: {
      ...heading(rows, "unit-signed-off", "Signed Off"),
      note: description(rows, "signed-off-note"),
      fields: fields.signedOff,
    },
    assuranceTab: label(rows, "page-name", "assurance", "Assurance"),
    // Legacy's Audit Trail buttons, each behind its RB row (fail closed).
    audit: auditLabel(rows, "audit-trail", "Audit Trail"),
    allocationAudit: auditLabel(rows, "audit-trail-allocations", "Audit Trail"),
    signOffTabs: signOffViews.map((view) => ({
      view,
      name: label(rows, "page-name", ...SIGN_OFF_TABS[view]),
    })),
    terms: {
      ...heading(
        rows,
        "terms-and-conditions",
        "Terms and Conditions to closeout Sub-Awards for Current Year",
      ),
      parts: [
        ["amendments-deadline", "Amendments Deadline"],
        ["final-deadline", "Final Claims & Reports Deadline"],
      ].map(([key, fallback]) => ({
        key,
        title: label(rows, "description", key, fallback),
        html: description(rows, key),
      })),
    },
    edit: {
      allowed: canEditSummary(context),
      texts: {
        edit: label(rows, "button-labels", "edit", "Edit"),
        save: label(rows, "button-labels", "save", "Save"),
        cancel: label(rows, "button-labels", "cancel", "Cancel"),
        // JET's required message, as legacy's validation group shows it.
        required: "Enter a value.",
      },
    },
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const saveInput = z
  .object({
    values: z
      .object(
        Object.fromEntries(
          EDITABLE.map((c) => [c, z.string().max(4000)]),
        ) as Record<EditableColumn, z.ZodString>,
      )
      .partial()
      .strict(),
  })
  .strict();
/** The record's Summary Edit right (legacy checkAccess 'unit-summary-edit'); legacy tested only that the row exists. */
const canEditSummary = (context: UnitRecordContext) =>
  context.access.roles.get("unit-summary-edit")?.edit === true;

/**
 * WRITES: the Summary's Save (legacy saveApplication → putAppSummary). The body is the row as read now with the shown
 * fields replaced; every shown field is required (legacy `required="true"`). A date left as it was keeps its stored
 * value; a changed one is sent as yyyy-MM-dd, as the date picker gives it.
 */
export async function saveAppSummary(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid summary.", 400);
  const context = await unitRecordRead(id, "summary");
  if (!canEditSummary(context))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change this summary.",
      403,
    );
  const row = await appSummaryOf(context);
  const next: AppSummaryRow = { ...row };
  for (const group of ["preparer", "cfo", "signedOff"] as const)
    for (const [, , column] of shownFields(row, group)) {
      const value = (parsed.data.values[column] ?? "").trim();
      if (value === "")
        throw new AppError("BAD_REQUEST", "Enter a value.", 400);
      if (!DATE_COLUMNS.has(column)) {
        next[column] = value;
        continue;
      }
      if (!DAY.test(value))
        throw new AppError("BAD_REQUEST", "Invalid date.", 400);
      next[column] =
        text(row[column]).slice(0, 10) === value ? row[column] : value;
    }
  await claims.saveAppSummary({ appId: Number(id), body: next });
  return { saved: true as const };
}
