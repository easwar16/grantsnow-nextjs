import "server-only";
import { z } from "zod";
import { eoi } from "@/server/oracle/api";
import { orNull } from "@/server/record/shared";
import type { ApprovalHost } from "@/server/record/approvals/workflow";
import { approvalActor } from "@/server/record/approvals/actor";
import { CONTRACT_MODULE, contractTab } from "./service";

const PAGE = "contracts-workflow";
/** Legacy `$application.variables.editableStatuses`. */
const EDITABLE_STATUSES = ["DRFT"];
const lockRow = z.object({ status: z.string().nullish() });

/**
 * The Contract Workflow tab as an approval host (legacy contracts-workflow-start-page.html mounts the shared
 * approval-workflow fragment with these parameters). Add Stage also needs the page's lock to read open; an unknown
 * lock closes it, as on every record.
 */
export async function contractApprovalHost(id: string): Promise<ApprovalHost> {
  const { context, contract } = await contractTab(id, PAGE);
  const page = context.access.pages.find((p) => p.name === PAGE);
  const [lock, username] = await Promise.all([
    page
      ? orNull(
          eoi
            .lockStatus({
              recordId: context.id,
              pageId: page.id,
              module: CONTRACT_MODULE,
            })
            .then((raw) => lockRow.parse(raw).status !== "UNLOCK"),
        )
      : null,
    approvalActor(context.session, context.user),
  ]);
  const status = contract.statusCode;
  const role = (key: string) => context.access.roles.get(key);
  return {
    token: context.session.token,
    user: context.user,
    username,
    docNum: contract.number,
    docType: CONTRACT_MODULE,
    approvalType: CONTRACT_MODULE,
    bundle: "contract",
    state: {
      editable: EDITABLE_STATUSES.includes(status),
      inApproval: status === "AIA",
      showAddStage:
        ["REWORK", "DRFT", "AIA", "WIP"].includes(status) && lock === false,
      modifyApprovers: ["AIA", "REWORK", "DRFT"].includes(status),
      // The RB `withdraw` gate is applied by the workflow itself.
      withdraw: status === "AIA",
      hasParent: false,
      approveStages: true,
    },
    rights: {
      route: role(PAGE)?.edit === true,
      addStage: role("contract-add-stage")?.edit === true,
      deleteStage: role("contract-add-stage")?.delete === true,
      addApprover: role("contracts-add-approver")?.edit === true,
      changeApprover: role("contracts-change-approver")?.edit === true,
      removeApprover: role("contracts-change-approver")?.delete === true,
    },
    groupLookup: "APPR_GRP_DETAIL_TYPE",
  };
}
