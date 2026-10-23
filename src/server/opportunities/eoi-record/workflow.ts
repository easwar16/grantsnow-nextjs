import "server-only";
import { eoiPageLock, eoiRecordRead } from "@/server/opportunities/record";
import type { ApprovalHost } from "@/server/approvals/workflow";
import { EDITABLE_STATUSES, EOI_MODULE, pageOf } from "./model";

/** Legacy `isShowAddStage`: open while the route can still change. */
export const showAddStage = (status: string) =>
  ["REWORK", "DRFT", "AIA", "WIP"].includes(status);

/**
 * The EOI Workflow tab as an approval host (legacy opportunities-eoi-approvals-start-page.html): the route is the
 * request number under `OPPORTUNITIES-EOI`. Rights are the record's roles; an unknown page lock counts as locked.
 * Generate, submit and withdraw need edit on the Workflow page, a role legacy did not check.
 */
export async function eoiApprovalHost(id: string): Promise<ApprovalHost> {
  const context = await eoiRecordRead(id, "approvals");
  const lock = await eoiPageLock(context, "approvals");
  const status = context.request.status_code ?? "";
  const role = (page: string) => context.access.roles.get(page);
  return {
    token: context.session.token,
    user: context.user,
    username: context.session.username ?? null,
    docNum: context.request.request_number,
    docType: EOI_MODULE,
    approvalType: EOI_MODULE,
    bundle: "opportunities-eoi",
    state: {
      editable: EDITABLE_STATUSES.includes(status),
      inApproval: status === "AIA",
      showAddStage: showAddStage(status) && !lock.locked,
      modifyApprovers: ["AIA", "REWORK", "DRFT"].includes(status),
      // The RB `withdraw` gate is applied by the workflow itself.
      withdraw: status === "AIA",
      hasParent: false,
      approveStages: true,
    },
    rights: {
      route: role(pageOf("approvals"))?.edit === true,
      addStage: role("eoi-add-stage")?.edit === true,
      // Legacy deletes a stage with no role check; here it needs delete on the Add Stage key.
      deleteStage: role("eoi-add-stage")?.delete === true,
      addApprover: role("eoi-add-approver")?.edit === true,
      changeApprover: role("opportunities-eoi-change-approver")?.edit === true,
      removeApprover:
        role("opportunities-eoi-change-approver")?.delete === true,
    },
    groupLookup: "APPR_GRP_DETAIL_TYPE",
  };
}
