import "server-only";
import { z } from "zod";
import {
  approvals,
  claims,
  lookups,
  people,
  reports,
} from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { AppError } from "@/lib/errors";
import type {
  AdjustmentLineDraft,
  UnitAdjustmentView,
  UnitAdjustmentsView,
} from "@/features/modules/claims/units/listing/types";
import { label, lookupOptions, numberish, optionalText } from "../listing";
import type { UnitRecordContext } from "../record";
import { ADJUSTABLE, claimAuditScope, claimOf, lineRow } from "./claims";
import { header, items } from "./goals";
import { available, statusConfig, type StatusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const amount = (v: unknown) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
const ROLE = "unit-claim-adjustment";

const adjustmentRow = z.object({
  claim_adj_id: numberish,
  adj_status_code: optionalText,
  adj_status_descr: optionalText,
  adjustment_date: optionalText,
  created_by: numberish,
  no_of_lines: numberish,
  cps_comment: optionalText,
  refund_check_ach_no: optionalText,
  total_refund_amount: numberish,
});
const adjLineRow = z.object({
  claim_adj_line_id: numberish,
  claim_line_id: numberish,
  line_no: numberish,
  position_type_code: optionalText,
  from_function_code: optionalText,
  from_object_code: optionalText,
  to_function_code: optionalText,
  to_object_code: optionalText,
  line_status_code: optionalText,
  line_status_descr: optionalText,
  adj_type_code: optionalText,
  justification: optionalText,
  expenditure_amount: numberish,
  refund_amount: numberish,
  expenditure_descr: optionalText,
  roster_name: optionalText,
  paid_to_company: optionalText,
  transaction_date: optionalText,
  transaction_no: optionalText,
  reviewer_comment: optionalText,
});
type AdjRow = z.infer<typeof adjustmentRow>;

/** The claim, refused unless it is the fund's and approved or paid. */
async function adjustableClaim(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
) {
  const { context, row } = await claimOf(id, {
    fund: rawFund,
    claim: rawClaim,
  });
  if (!ADJUSTABLE.includes(text(row.claim_status_code)))
    throw new AppError(
      "FORBIDDEN",
      "Adjustments open for an approved or paid claim.",
      403,
    );
  return { context, claimId: Number(row.claim_id) };
}
const listOf = async (context: UnitRecordContext, claimId: number) =>
  items(
    adjustmentRow,
    await claims.adjustments({ claimId, orgId: context.user.organizationId }),
  );
/** Legacy row Delete: the delete right and a new adjustment or one whose status allows a user edit. */
const adjOpen = (config: StatusConfig, status: string) =>
  status === "" || available(config, ["CLAIM_ADJUSTMENT_HEADER"], status);

/** A claim's Adjustments (legacy adjustmentsLogTable): the list with each row's Delete, and Add Adjustment. */
export async function adjustmentsView(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
): Promise<UnitAdjustmentsView> {
  const { context, claimId } = await adjustableClaim(id, rawFund, rawClaim);
  const [rows, list, config, everyone] = await Promise.all([
    resources(),
    listOf(context, claimId),
    statusConfig().catch((): StatusConfig => ({})),
    people.all().catch(() => []),
  ]);
  const role = context.access.roles.get(ROLE);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const nameOf = (v: unknown) =>
    everyone.find((p) => String(p.person_id) === text(v))?.full_name ?? text(v);
  return {
    // Legacy Add Adjustment: the role row (read, fail closed).
    canAdd: role?.read === true,
    headers: Object.fromEntries(
      (
        [
          ["number", "adjustment-number", "Adjustment No"],
          ["status", "adjustment-status", "Status"],
          ["date", "adjustment-date", "Adjustment Date"],
          ["by", "adjustment-by", "Adjusted By"],
          ["lines", "adjustment-lines", "Lines"],
          ["comments", "adjustment-comments", "Comments"],
        ] as const
      ).map(([k, rb, fallback]) => [k, header(rows, rb, fallback)]),
    ) as UnitAdjustmentsView["headers"],
    rows: list.map((a) => ({
      key: text(a.claim_adj_id),
      status: text(a.adj_status_descr),
      date: text(a.adjustment_date),
      by: nameOf(a.created_by),
      lines: text(a.no_of_lines),
      comments: text(a.cps_comment),
      canDelete:
        role?.delete === true && adjOpen(config, text(a.adj_status_code)),
    })),
    texts: {
      heading: t("header-labels", "claim-adjustments", "Adjustments"),
      add: t("button-labels", "add-adjustment", "Add Adjustment"),
      view: t("button-labels", "view", "View"),
      audits: t("button-labels", "audits", "Audits"),
      delete: t("button-labels", "delete", "Delete"),
      empty: t("helper-texts", "no-data", "No data to display."),
    },
  };
}

/** The adjustment's header, lines and route, refused when it is not the claim's. */
async function adjustmentRecord(
  context: UnitRecordContext,
  claimId: number,
  rawAdjustment: unknown,
) {
  const list = await listOf(context, claimId);
  const row = list.find((a) => text(a.claim_adj_id) === text(rawAdjustment));
  if (!row)
    throw new AppError(
      "FORBIDDEN",
      "This adjustment is not on the claim.",
      403,
    );
  const adjustmentId = Number(row.claim_adj_id);
  const [head, lines, stages] = await Promise.all([
    claims
      .adjustment({ adjustmentId })
      .then((raw) => items(adjustmentRow, raw)[0] ?? row),
    claims
      .adjustmentLines({ adjustmentId })
      .then((raw) => items(adjLineRow, raw)),
    approvals.stages({
      docNum: String(adjustmentId),
      docType: "CLAIM_ADJUSTMENT_HEADER",
    }),
  ]);
  return { head, lines, stages };
}
/** The adjustment route's facts for the approval host (legacy adjustment Submit / Withdraw gates). */
export async function adjustmentApproval(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
  rawAdjustment: unknown,
) {
  const { context, claimId } = await adjustableClaim(id, rawFund, rawClaim);
  const [{ head, lines }, config] = await Promise.all([
    adjustmentRecord(context, claimId, rawAdjustment),
    statusConfig(),
  ]);
  return {
    context,
    config,
    adjustmentId: text(head.claim_adj_id),
    status: text(head.adj_status_code),
    lines: lines.map((l) => text(l.claim_adj_line_id)),
  };
}

const draftOf = (
  l: z.infer<typeof adjLineRow>,
  editable: boolean,
): AdjustmentLineDraft => ({
  key: text(l.claim_adj_line_id) || `line-${text(l.claim_line_id)}`,
  adjLineId: text(l.claim_adj_line_id),
  claimLineId: text(l.claim_line_id),
  number: text(l.line_no),
  positionType: text(l.position_type_code),
  fromFunction: text(l.from_function_code),
  fromObject: text(l.from_object_code),
  type: text(l.adj_type_code),
  toFunction: text(l.to_function_code),
  toObject: text(l.to_object_code),
  justification: text(l.justification),
  expenditure: amount(l.expenditure_amount),
  refund:
    amount(l.refund_amount) === null ? "" : String(amount(l.refund_amount)),
  description: text(l.expenditure_descr),
  person:
    text(l.position_type_code) === "POSITION"
      ? text(l.roster_name)
      : text(l.paid_to_company),
  transDate: text(l.transaction_date).slice(0, 10),
  transNo: text(l.transaction_no),
  status: text(l.line_status_descr),
  statusCode: text(l.line_status_code),
  comments: text(l.reviewer_comment),
  editable,
});
/** Legacy addAllLinesToAdj / addClaimLines: a claim line as a new REJECT line of the adjustment. */
const fromClaimLine = (l: z.infer<typeof lineRow>): AdjustmentLineDraft => ({
  key: `line-${text(l.claim_line_id)}`,
  adjLineId: "",
  claimLineId: text(l.claim_line_id),
  number: text(l.line_no),
  positionType: text(l.position_type_code),
  fromFunction: text(l.function_code),
  fromObject: text(l.object_code),
  type: "REJECT",
  toFunction: "",
  toObject: "",
  justification: "",
  expenditure: amount(l.expenditure_amount),
  refund: "0",
  description: text(l.expenditure_descr),
  person:
    text(l.position_type_code) === "POSITION"
      ? text(l.roster_name)
      : text(l.paid_to_company),
  transDate: text(l.transaction_date).slice(0, 10),
  transNo: text(l.transaction_no),
  status: "",
  statusCode: "",
  comments: "",
  editable: true,
});
/** The functions and objects the fund's claim lines may move to (legacy FUNC / OBJ over the hierarchy). */
async function codesOf(appFundId: number) {
  const tree = items(
    z.object({
      activity_type_code: optionalText,
      function_codes: z
        .array(
          z.object({
            function_code: optionalText,
            function_code_descr: optionalText,
            object_codes: z
              .array(
                z.object({
                  object_code: optionalText,
                  object_code_descr: optionalText,
                }),
              )
              .nullish(),
          }),
        )
        .nullish(),
    }),
    await claims.activityHierarchy({ appFundId }),
  );
  return tree.map((t) => ({
    type: text(t.activity_type_code),
    functions: (t.function_codes ?? []).map((f) => ({
      value: text(f.function_code),
      label: text(f.function_code_descr),
      objects: (f.object_codes ?? []).map((o) => ({
        value: text(o.object_code),
        label: text(o.object_code_descr),
      })),
    })),
  }));
}

/**
 * One adjustment, or a new one (`adjustment` empty; legacy addNewAdjustment / viewAdjustmentDetails): its header, its
 * lines as drafts with their Edit / Delete gates, the claim's lines to add, the line types, and the codes a RECLASS
 * line may move to.
 */
export async function adjustmentView(
  id: string,
  rawFund: unknown,
  rawClaim: unknown,
  rawAdjustment: unknown,
): Promise<UnitAdjustmentView> {
  const { context, claimId } = await adjustableClaim(id, rawFund, rawClaim);
  const isNew = text(rawAdjustment) === "";
  const [rows, codes, config, claimLines, tree, record] = await Promise.all([
    resources(),
    lookups.codes({ types: "FPCG_ADJ_LINE_TYPE" }),
    statusConfig(),
    claims.claimLines({ claimId }).then((raw) => items(lineRow, raw)),
    codesOf(Number(rawFund)),
    isNew
      ? Promise.resolve(null)
      : adjustmentRecord(context, claimId, rawAdjustment),
  ]);
  const role = context.access.roles.get(ROLE);
  const status = text(record?.head.adj_status_code);
  const routed = (record?.stages.length ?? 0) > 0;
  const open = !routed && adjOpen(config, status);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const h: Partial<AdjRow> = record?.head ?? {};
  return {
    key: isNew ? "" : text(h.claim_adj_id),
    canEdit: role?.edit === true,
    canDeleteLines: role?.delete === true,
    open,
    canExport:
      !isNew && context.access.roles.get("claims-export")?.read === true,
    status: text(h.adj_status_descr),
    refundCheck: text(h.refund_check_ach_no),
    comment: text(h.cps_comment),
    totalRefund: amount(h.total_refund_amount),
    types: lookupOptions(codes, "FPCG_ADJ_LINE_TYPE"),
    codes: tree,
    claimLines: claimLines.map(fromClaimLine),
    lines: (record?.lines ?? []).map((l) =>
      draftOf(
        l,
        !routed &&
          (text(l.line_status_code) === "" ||
            available(
              config,
              ["CLAIM_ADJUSTMENT_LINE"],
              text(l.line_status_code),
            )),
      ),
    ),
    // Legacy line Approvals: once the adjustment is routed, unless the line is still open to a user edit.
    lineApprovals: routed,
    headers: Object.fromEntries(
      (
        [
          ["number", "adjustment-number", "No"],
          ["fromFunction", "adjustment-original-function", "Original Function"],
          ["fromObject", "adjustment-original-object", "Original Object"],
          ["status", "adjustment-status", "Status"],
          ["type", "adjustment-type", "Type"],
          ["toFunction", "adjustment-revised-function", "Revised Function"],
          ["toObject", "adjustment-revised-object", "Revised Object"],
          ["justification", "adjustment-justification", "Justification"],
          [
            "expenditure",
            "adjustment-expenditure-amount",
            "Expenditure Amount",
          ],
          ["refund", "adjustment-refund-amount", "Refund Amount"],
          [
            "description",
            "adjustment-expenditure-description",
            "Expenditure Description",
          ],
          ["person", "adjustment-person-paid", "Person Paid"],
          ["transDate", "adjustment-transaction-date", "Transaction Date"],
          ["transNo", "adjustment-transaction-number", "Transaction Number"],
          ["comments", "adjustment-reviewer-comment", "Reviewer Comment"],
        ] as const
      ).map(([k, rb, fallback]) => [k, header(rows, rb, fallback)]),
    ) as UnitAdjustmentView["headers"],
    labels: Object.fromEntries(
      (
        [
          ["adjustment-number", "Adjustment No"],
          ["adjustment-status", "Status"],
          ["refund-check-number", "Refund Check / ACH Number"],
          ["total-refund-amount", "Total Refund Amount"],
          ["adjustment-comment", "Adjustment Comment"],
          ["adjustment-type", "Type"],
          ["adjustment-expenditure-amount", "Expenditure Amount"],
          ["adjustment-original-function", "Original Function"],
          ["adjustment-revised-function", "Revised Function"],
          ["adjustment-original-object", "Original Object"],
          ["adjustment-revised-object", "Revised Object"],
          ["adjustment-refund-amount", "Refund Amount"],
          ["adjustment-justification", "Justification"],
        ] as const
      ).map(([k, fallback]) => [k, t("labels", k, fallback)]),
    ),
    texts: {
      addLine: t("button-labels", "add-claim-line", "Add Claim Line"),
      addAll: t("button-labels", "add-all-claim-line", "Add All Claim Lines"),
      save: t("button-labels", "save", "Save"),
      export: t("button-labels", "export", "Export"),
      lineTitle: t("dialog-titles", "claim-line-details", "Claim Line Details"),
      submit: t("button-labels", "submit", "Submit"),
      update: t("button-labels", "update", "Update"),
      edit: t("button-labels", "edit", "Edit"),
      delete: t("button-labels", "delete", "Delete"),
      audits: t("button-labels", "audits", "Audits"),
      approvals: t("button-labels", "approvals", "Approvals"),
      approvalTitle: t("dialog-titles", "approval-details", "Approval Details"),
      empty: t("helper-texts", "no-data", "No data to display."),
      // Legacy addAllLinesToAdj / addClaimLines / updateAdjustmentLine literal toasts.
      alreadyExist: "Already Exist!",
      sameCodes: "Save values selected for re-classification",
    },
  };
}

const lineInput = z
  .object({
    adjLineId: z.union([z.literal(""), z.string().regex(/^\d{1,15}$/)]),
    claimLineId: z.string().regex(/^\d{1,15}$/),
    type: z.string().regex(/^[A-Z_]{1,30}$/),
    toFunction: z.string().max(30),
    toObject: z.string().max(30),
    justification: z.string().max(4000),
    refund: z.string().max(30),
  })
  .strict();
const saveInput = z
  .object({
    fund: z.string().regex(/^\d{1,15}$/),
    claim: z.string().regex(/^\d{1,15}$/),
    adjustment: z.union([z.literal(""), z.string().regex(/^\d{1,15}$/)]),
    refundCheck: z.string().max(100),
    comment: z.string().max(4000),
    lines: z.array(lineInput).max(500),
  })
  .strict();
const refuse = (message: string, detail?: string) =>
  new AppError("BAD_REQUEST", message, 400, detail);

/**
 * WRITES: an adjustment's Save (legacy saveAdjustmentLines: postClaimAdjustments / putClaimAdjustment). The adjustment
 * must be open and the user hold `unit-claim-adjustment` edit; each line is a claim line of this claim (or the
 * adjustment's own), its type a configured one, a RECLASS line's revised codes the fund's; legacy's checks and
 * messages, and its explicit pick per line.
 */
export async function saveAdjustment(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) throw refuse("Please fill all the required fields!");
  const input = parsed.data;
  const view = await adjustmentView(
    id,
    input.fund,
    input.claim,
    input.adjustment,
  );
  if (!view.canEdit || !view.open)
    throw new AppError("FORBIDDEN", "This adjustment cannot be changed.", 403);
  if (!input.refundCheck.trim()) throw refuse("Refund Check Number Missing");
  if (!input.comment.trim()) throw refuse("Adjustment Comment Missing");
  const known = new Map(view.lines.map((l) => [l.adjLineId, l]));
  const claimLines = new Map(view.claimLines.map((l) => [l.claimLineId, l]));
  const types = new Set(view.types.map((t) => t.value));
  const lines = input.lines.map((l) => {
    const stored = l.adjLineId ? known.get(l.adjLineId) : undefined;
    const source = stored ?? claimLines.get(l.claimLineId);
    if (
      !source ||
      (l.adjLineId && !stored) ||
      source.claimLineId !== l.claimLineId
    )
      throw new AppError("FORBIDDEN", "This line is not on the claim.", 403);
    // A line the user may not change goes as stored.
    const d =
      stored && !stored.editable
        ? {
            type: stored.type,
            toFunction: stored.toFunction,
            toObject: stored.toObject,
            justification: stored.justification,
            refund: stored.refund,
          }
        : l;
    if (!types.has(d.type))
      throw refuse("Please fill all the required fields!");
    if (!d.justification.trim())
      throw refuse(
        "No Justification",
        `Provide justification for Expenditure : ${source.description}`,
      );
    if (d.type === "REJECT" && !Number(d.refund))
      throw refuse(
        "No Amount",
        `Provide refund amount for Expenditure : ${source.description}`,
      );
    if (d.type === "RECLASS") {
      const fns =
        view.codes.find((c) => c.type === source.positionType)?.functions ?? [];
      const fn = fns.find((f) => f.value === d.toFunction);
      if (!fn || !fn.objects.some((o) => o.value === d.toObject))
        throw refuse("Please fill all the required fields!");
      if (
        d.toFunction === source.fromFunction &&
        d.toObject === source.fromObject
      )
        throw refuse("Save values selected for re-classification");
    }
    return {
      claim_adj_line_id: l.adjLineId ? Number(l.adjLineId) : null,
      claim_line_id: Number(l.claimLineId),
      adj_type_code: d.type,
      from_function_code: source.fromFunction,
      from_object_code: source.fromObject,
      to_function_code: d.type !== "REJECT" ? d.toFunction || null : null,
      to_object_code: d.type !== "REJECT" ? d.toObject || null : null,
      justification: d.justification,
      refund_amount: d.type !== "RECLASS" ? Number(d.refund) || 0 : 0,
      reviewer_comment: stored?.comments || null,
    };
  });
  const body = {
    refund_check_ach_no: input.refundCheck,
    cps_comment: input.comment,
    adjustment_lines: lines,
  };
  if (input.adjustment) {
    await claims.updateAdjustment({
      adjustmentId: Number(input.adjustment),
      body,
    });
    return { adjustment: input.adjustment };
  }
  const reply = await claims.createAdjustment({
    claimId: Number(input.claim),
    body,
  });
  const minted = items(z.object({ claim_adj_id: numberish }), reply)[0]
    ?.claim_adj_id;
  if (minted === null || minted === undefined)
    throw new AppError("CONTRACT", "The adjustment was not created.");
  return { adjustment: text(minted) };
}

/** WRITES: removes an adjustment (legacy deleteAdjustment: the delete right and an open status; no confirm). */
export async function deleteAdjustment(id: string, raw: unknown) {
  const parsed = z
    .object({
      fund: z.string(),
      claim: z.string(),
      adjustment: z.string().regex(/^\d{1,15}$/),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) throw refuse("Invalid adjustment.");
  const view = await adjustmentsView(id, parsed.data.fund, parsed.data.claim);
  const row = view.rows.find((r) => r.key === parsed.data.adjustment);
  if (!row)
    throw new AppError(
      "FORBIDDEN",
      "This adjustment is not on the claim.",
      403,
    );
  if (!row.canDelete)
    throw new AppError("FORBIDDEN", "This adjustment cannot be deleted.", 403);
  await claims.deleteAdjustment({ adjustmentId: Number(row.key) });
  return { deleted: true as const };
}

/** WRITES (generate-report): an adjustment's lines (legacy report-vbcs-adjustment-line-listing). */
export async function exportAdjustmentLines(id: string, raw: unknown) {
  const parsed = z
    .object({
      fund: z.string().regex(/^\d{1,15}$/),
      claim: z.string(),
      adjustment: z.string(),
      status: z.string(),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) throw refuse("Invalid export.");
  const { context, claimId } = await adjustableClaim(
    id,
    parsed.data.fund,
    parsed.data.claim,
  );
  const { head } = await adjustmentRecord(
    context,
    claimId,
    parsed.data.adjustment,
  );
  if (context.access.roles.get("claims-export")?.read !== true)
    throw new AppError("FORBIDDEN", "You do not have access to export.", 403);
  return reports.generate({
    body: serverFunctions.reports.reportPayload(
      "report-vbcs-adjustment-line-listing",
      {
        object_type: "CLAIMS",
        object_id: Number(head.claim_adj_id),
        org_id: context.user.organizationId,
        app_fund_id: Number(parsed.data.fund),
        line_status_code: /^[A-Z0-9_]{0,30}$/.test(parsed.data.status)
          ? parsed.data.status
          : "",
      },
    ),
  });
}

/** The audit scope of an adjustment or one of its lines (legacy loadAuditTrail ADJ_HEADER / ADJ_LINE). */
export async function adjustmentAuditScope(
  id: string,
  claim: string,
  adjustment: string | null,
  sec: string | undefined,
) {
  if (!/^\d{1,15}$/.test(sec ?? ""))
    throw new AppError("BAD_REQUEST", "Invalid audit scope.", 400);
  const { context } = await claimAuditScope(id, claim);
  const list = await listOf(context, Number(claim));
  if (adjustment === null) {
    if (!list.some((a) => text(a.claim_adj_id) === sec))
      throw new AppError(
        "FORBIDDEN",
        "This adjustment is not on the claim.",
        403,
      );
    return { context, type: "CLAIM_ADJUSTMENT_HEADER", id: sec! };
  }
  if (!list.some((a) => text(a.claim_adj_id) === adjustment))
    throw new AppError(
      "FORBIDDEN",
      "This adjustment is not on the claim.",
      403,
    );
  const lines = items(
    adjLineRow,
    await claims.adjustmentLines({ adjustmentId: Number(adjustment) }),
  );
  if (!lines.some((l) => text(l.claim_adj_line_id) === sec))
    throw new AppError("FORBIDDEN", "This line is not on the adjustment.", 403);
  return { context, type: "CLAIM_ADJUSTMENT_LINE", id: sec! };
}
