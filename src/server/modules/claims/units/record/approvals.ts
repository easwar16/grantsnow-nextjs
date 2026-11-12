import "server-only";
import { AppError } from "@/lib/errors";
import { approvalActor } from "@/server/record/approvals/actor";
import type { ApprovalHost } from "@/server/record/approvals/workflow";
import { BUNDLE } from "../listing";
import type { UnitRecordContext } from "../record";
import { unitRecordRead } from "../record";
import { activitiesOf, summaryOf } from "./activities";
import { activityOf } from "./activity";
import { amendmentApproval } from "./amendments";
import { rosterMember } from "./roster";
import { claimRecord } from "./claims";
import { adjustmentApproval } from "./adjustments";
import { appFundsOf, fundOf } from "./goals";
import { available, statusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/**
 * The route's document: `fund-<app_fund_id>`, `amendment-<app_fund_id>-<amendment_id>`,
 * `activity-<app_fund_id>-<activity_id>-<amend_version_id>`, `roster-<roster_id>`, `claim-<app_fund_id>-<claim_id>`
 * `line-<app_fund_id>-<claim_id>-<claim_line_id>`, `adjustment-<app_fund_id>-<claim_id>-<claim_adj_id>` or
 * `adjline-<app_fund_id>-<claim_id>-<claim_adj_id>-<claim_adj_line_id>`.
 */
const DOC =
  /^(?:fund-(\d{1,15})|amendment-(\d{1,15})-(\d{1,15})|activity-(\d{1,15})-(\d{1,15})-(\d{1,15})|roster-(\d{1,15})|claim-(\d{1,15})-(\d{1,15})|line-(\d{1,15})-(\d{1,15})-(\d{1,15})|adjustment-(\d{1,15})-(\d{1,15})-(\d{1,15})|adjline-(\d{1,15})-(\d{1,15})-(\d{1,15})-(\d{1,15}))$/;

/**
 * The fund's or an amendment's approval route on the shared workflow (legacy claims-unit-activities: the approvals
 * list under Activities List / the amendment, Submit for Approval and Withdraw in the fund bar). Submit generates the
 * route and needs the plan complete (activities or lines, Unapplied Balance 0, a draft or rework status that allows a
 * user edit); Withdraw while in approval, behind RB `withdraw-approval`. Legacy gates the route actions by status
 * alone; here they also need an edit right (fail closed): the Activities page's, or `unit-add-claim` for a claim.
 */
export async function unitApprovalHost(
  id: string,
  rawDoc: string,
): Promise<ApprovalHost> {
  const doc = DOC.exec(rawDoc);
  if (!doc) throw new AppError("BAD_REQUEST", "Invalid approval route.", 400);
  if (doc[1] !== undefined) {
    const context = await unitRecordRead(id, "activities");
    const [funds, config] = await Promise.all([
      appFundsOf(context),
      statusConfig(),
    ]);
    const fund = fundOf(funds, doc[1]);
    const appFundId = Number(fund.app_fund_id);
    const [summary, activities] = await Promise.all([
      summaryOf(context, appFundId),
      activitiesOf(context, appFundId, ""),
    ]);
    const status = text(summary?.fund_status_code);
    return host(context, {
      docNum: String(appFundId),
      docType: "CLAIM_FUNDS",
      status,
      planned:
        ["DRFT", "REWORK"].includes(status) &&
        activities.length > 0 &&
        Number(summary?.unapplied_balance) === 0 &&
        available(config, ["CLAIM_FUNDS", "CLAIM_FUNDS_AMENDMENT"], status),
      inApproval: status === "AIA",
      open: ["AIA", "REWORK", "DRFT"],
    });
  }
  if (doc[4] !== undefined) {
    // Legacy activity-approvals sub-tab: the version's route, to read and act on; no Submit of its own.
    const context = await unitRecordRead(id, "activities");
    const { row } = await activityOf(context, {
      fund: Number(doc[4]),
      activity: Number(doc[5]),
      version: Number(doc[6]),
    });
    return host(context, {
      docNum: text(row.amend_version_id),
      docType: "CLAIM_ACTIVITY",
      status: "",
      planned: false,
      inApproval: false,
      open: [],
    });
  }
  if (doc[7] !== undefined) {
    // Legacy roster menu › Approvals (approvalsDialog): the member's route, to read and act on.
    const context = await unitRecordRead(id, "activities");
    const member = await rosterMember(context, doc[7]);
    return host(context, {
      docNum: text(member.roster_id),
      docType: "CLAIM_ROSTER",
      status: "",
      planned: false,
      inApproval: false,
      open: [],
    });
  }
  if (doc[8] !== undefined) {
    // Legacy claim drawer: Submit for Approval / Withdraw on the claim (CLAIM_HEADER), rights `unit-add-claim` edit.
    const { context, head, lines, config } = await claimRecord(
      id,
      doc[8],
      doc[9],
    );
    const status = text(head?.claim_status_code);
    return host(
      context,
      {
        docNum: doc[9],
        docType: "CLAIM_HEADER",
        status,
        planned:
          ["DRFT", "REWORK"].includes(status) &&
          lines.length > 0 &&
          available(
            config,
            ["CLAIM_HEADER", "CLAIM_ADJUSTMENT_HEADER"],
            status,
          ),
        inApproval: status === "AIA",
        open: ["AIA", "REWORK", "DRFT"],
      },
      "unit-add-claim",
    );
  }
  if (doc[10] !== undefined) {
    // Legacy claim line menu › Approvals (CLAIM_LINE): the line's route, to read and act on.
    const { context, lines } = await claimRecord(id, doc[10], doc[11]);
    if (!lines.some((l) => text(l.claim_line_id) === doc[12]))
      throw new AppError("FORBIDDEN", "This line is not on the claim.", 403);
    return host(
      context,
      {
        docNum: doc[12],
        docType: "CLAIM_LINE",
        status: "",
        planned: false,
        inApproval: false,
        open: [],
      },
      "unit-add-claim",
    );
  }
  if (doc[13] !== undefined || doc[16] !== undefined) {
    // Legacy adjustment: Submit / Withdraw on CLAIM_ADJUSTMENT_HEADER; a line's route (CLAIM_ADJUSTMENT_LINE) to act on.
    const line = doc[16] !== undefined;
    const [fund, claim, adj] = line
      ? [doc[16], doc[17], doc[18]]
      : [doc[13], doc[14], doc[15]];
    const a = await adjustmentApproval(id, fund, claim, adj);
    if (line && !a.lines.includes(doc[19]))
      throw new AppError(
        "FORBIDDEN",
        "This line is not on the adjustment.",
        403,
      );
    return host(
      a.context,
      line
        ? {
            docNum: doc[19],
            docType: "CLAIM_ADJUSTMENT_LINE",
            status: "",
            planned: false,
            inApproval: false,
            open: [],
          }
        : {
            docNum: a.adjustmentId,
            docType: "CLAIM_ADJUSTMENT_HEADER",
            status: a.status,
            planned:
              ["DRFT", "REWORK"].includes(a.status) &&
              a.lines.length > 0 &&
              available(a.config, ["CLAIM_ADJUSTMENT_HEADER"], a.status),
            inApproval: a.status === "AIA",
            open: ["AIA", "REWORK", "DRFT"],
          },
      "unit-claim-adjustment",
    );
  }
  const facts = await amendmentApproval(id, doc[2], doc[3]);
  const summary = await summaryOf(
    facts.context,
    Number(facts.fund.app_fund_id),
  );
  return host(facts.context, {
    docNum: facts.amendmentId,
    docType: "CLAIM_FUNDS_AMENDMENT",
    status: facts.status,
    planned:
      ["ADJ_DRFT", "ADJ_REWORK"].includes(facts.status) &&
      facts.lines > 0 &&
      Number(summary?.unapplied_balance) === 0 &&
      available(facts.config, ["CLAIM_FUNDS_AMENDMENT"], facts.status),
    inApproval: facts.status === "ADJ_AIA",
    open: ["ADJ_AIA", "ADJ_REWORK", "ADJ_DRFT"],
  });
}

async function host(
  context: UnitRecordContext,
  d: {
    docNum: string;
    docType: string;
    status: string;
    planned: boolean;
    inApproval: boolean;
    open: string[];
  },
  /** The role row whose edit right opens the route's actions. */
  rightsPage = "claims-unit-activities",
): Promise<ApprovalHost> {
  const edit = context.access.roles.get(rightsPage)?.edit === true;
  return {
    token: context.session.token,
    user: context.user,
    username: await approvalActor(context.session, context.user),
    docNum: d.docNum,
    docType: d.docType,
    // Legacy fetchApprovalHistory: approval_type is the document type.
    approvalType: d.docType,
    bundle: BUNDLE,
    state: {
      editable: d.planned,
      inApproval: d.inApproval,
      // Legacy's Claims approvals list has no Add Stage.
      showAddStage: false,
      modifyApprovers: d.open.includes(d.status),
      withdraw: d.inApproval,
      hasParent: false,
      approveStages: true,
    },
    rights: {
      route: edit,
      addStage: false,
      deleteStage: edit,
      addApprover: edit,
      changeApprover: edit,
      removeApprover: edit,
    },
    groupLookup: "APPR_GRP_DETAIL_TYPE",
    submitGenerates: true,
    keys: { submit: "submit-approval", withdraw: "withdraw-approval" },
  };
}
