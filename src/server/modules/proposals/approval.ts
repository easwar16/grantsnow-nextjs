import "server-only";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "./record";
import type { ApprovalHost } from "@/server/record/approvals/workflow";

/** Proposal's shared approval fragment host; this increment exposes the route as a read. */
export async function proposalApprovalHost(
  type: RecordIdentity["type"],
  id: string,
): Promise<ApprovalHost> {
  const context = await proposalPage(type, id, "proposals-approvals");
  return {
    token: context.session.token,
    user: context.user,
    username: null,
    docNum: context.summary.reference,
    docType: type,
    approvalType: type,
    bundle: context.bundle,
    state: {
      editable: false,
      inApproval: context.summary.statusCode === "AIA",
      showAddStage: false,
      modifyApprovers: false,
      withdraw: false,
      hasParent: type === "SUB_PROPOSAL" || type === "EXTENSION_PROPOSAL",
      approveStages: false,
    },
    rights: {
      route: false,
      addStage: false,
      deleteStage: false,
      addApprover: false,
      changeApprover: false,
      removeApprover: false,
    },
    groupLookup: "APPR_GRP_DETAIL_TYPE",
  };
}
