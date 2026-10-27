import "server-only";
import type { HistoryHost } from "@/server/record/objects/history";
import type { DelegationHost } from "@/server/record/objects/delegations";
import type { ApprovalHost } from "@/server/record/approvals/workflow";
import { approvalActor } from "@/server/record/approvals/actor";
import { AWARD_MODULE, pageOf } from "@/shared/awards/award-record";
import { awardPageLock, awardRecordRead, isDraft } from "../record";
const BUNDLE = "award";
/** The label keys the award history host passes (awards-history-start-page.html:26-46). */
const HISTORY_KEYS: HistoryHost["keys"] = {
  title: ["header-labels", "award-status-history"],
  status: ["labels", "history-proposal-status"],
  mode: ["labels", "history-process-mode"],
  comments: ["labels", "history-comments"],
  user: ["labels", "history-user"],
  date: ["labels", "history-date"],
  approvalTitle: ["header-labels", "history-page-approval-history"],
  approvalName: ["labels", "approval-full-name"],
  approvalStatus: ["labels", "approval-status"],
  approvalStage: ["labels", "approval-stage"],
  approvalComments: ["labels", "approval-user-comments"],
  approvalUpdated: ["labels", "approval-last-updated-date"],
  statusLabel: ["labels", "history-proposal-status"],
  cancel: ["button-labels", "history-cancel"],
  save: ["button-labels", "history-save"],
};
/** The History tab: AWARD_STATUS; Add Status and Abandon need edit on their role keys (legacy checkAccess). */
export async function awardHistoryHost(id: string): Promise<HistoryHost> {
  const { session, user, award, access } = await awardRecordRead(id, "history");
  const edit = (key: string) => access.roles.get(key)?.edit === true;
  return {
    token: session.token,
    user,
    objectType: AWARD_MODULE,
    objectId: id,
    objectNumber: award.award_number ?? id,
    approvalType: AWARD_MODULE,
    bundle: BUNDLE,
    statusLookup: "AWARD_STATUS",
    statusCode: award.award_status ?? null,
    rights: {
      addStatus: edit("award-add-status"),
      abandon: edit("award-history-abandon-button"),
    },
    keys: HISTORY_KEYS,
  };
}
/** The Delegation tab: rights from `awards-delegation`, the default page the header (legacy `default`). */
export async function awardDelegationHost(id: string): Promise<DelegationHost> {
  const { session, user, access } = await awardRecordRead(id, "delegation");
  const rights = access.roles.get(pageOf("delegation"));
  return {
    token: session.token,
    user,
    objectType: AWARD_MODULE,
    objectId: id,
    bundle: BUNDLE,
    defaultPage: pageOf("header"),
    rights: { edit: rights?.edit === true, delete: rights?.delete === true },
  };
}

/** Legacy `isShowAddStage`: open while the route can still change. */
const showAddStage = (status: string) =>
  ["REWORK", "DRFT", "AIA", "WIP"].includes(status);
/**
 * The Approvals tab as an approval host (awards-approvals-start-page.html): the route is the award number under
 * AWARD. Withdraw also needs read and edit on `awards-approvals-withdraw`. Legacy had no lock term on Add Stage;
 * a finalized or unreadable page lock closes it here, as on the EOI record.
 */
export async function awardApprovalHost(id: string): Promise<ApprovalHost> {
  const context = await awardRecordRead(id, "approvals");
  const lock = await awardPageLock(context, "approvals");
  const status = context.award.award_status ?? "";
  const role = (page: string) => context.access.roles.get(page);
  const withdraw = role("awards-approvals-withdraw");
  return {
    token: context.session.token,
    user: context.user,
    username: await approvalActor(context.session, context.user),
    docNum: context.award.award_number ?? id,
    docType: AWARD_MODULE,
    approvalType: AWARD_MODULE,
    bundle: BUNDLE,
    state: {
      editable: isDraft(context),
      inApproval: status === "AIA",
      showAddStage: showAddStage(status) && !lock.locked,
      modifyApprovers: ["AIA", "REWORK", "DRFT"].includes(status),
      withdraw:
        status === "AIA" && withdraw?.read === true && withdraw.edit === true,
      hasParent: false,
      approveStages: true,
    },
    rights: {
      route: role(pageOf("approvals"))?.edit === true,
      addStage: role("award-add-stage")?.edit === true,
      deleteStage: role("award-add-stage")?.delete === true,
      addApprover: role("awards-add-approver")?.edit === true,
      changeApprover: role("awards-change-approver")?.edit === true,
      removeApprover: role("awards-change-approver")?.delete === true,
    },
    groupLookup: "APPR_GRP_DETAIL_TYPE",
  };
}
