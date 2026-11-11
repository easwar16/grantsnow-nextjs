import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { approvalActor } from "@/server/record/approvals/actor";
import type { ApprovalHost } from "@/server/record/approvals/workflow";
import { eoi } from "@/server/oracle/api";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { ethicsRecord, ethicsStakeholder } from "./record";
import { ethicsEditableStatus } from "./status";

/** The selected Ethics stakeholder is the approval document, while setup is the record access scope. */
export async function ethicsApprovalHost(id: string, participant?: string, access?: string): Promise<ApprovalHost> {
  const [record, { session, user }] = await Promise.all([
    ethicsRecord(id, access), authenticate(),
  ]);
  if (!record.tabs.includes("ethics-approvals"))
    throw new AppError("FORBIDDEN", "Ethics Approvals access has not been granted.", 403);
  const stakeholder = ethicsStakeholder(record, user.personId, participant);
  if (!stakeholder)
    throw new AppError("FORBIDDEN", "Ethics participant access has not been granted.", 403);
  const pageId = record.pageIds["ethics-approvals"];
  let locked = true;
  if (pageId) {
    try {
      const body = z.object({ status: z.string() }).parse(await eoi.lockStatus({
        recordId: stakeholder.id, pageId, module: "ETHICS",
      }));
      locked = body.status !== "UNLOCK";
    } catch { /* A failed lock read keeps every modification disabled. */ }
  }
  const vars = await globalVariables(session.token).catch(() => []);
  const autoSubmit = vars.find((item) => item.var_key === "ETHICS_AUTO_SUBMIT")?.var_value === "Y";
  const right = (key: string) => record.rights[key]?.edit === true;
  const editableStatus = await ethicsEditableStatus(stakeholder.statusCode).catch(() => false);
  const inApproval = stakeholder.statusCode === "AIA";
  return {
    token: session.token,
    user,
    username: await approvalActor(session, user),
    docNum: stakeholder.id,
    docType: "ETHICS",
    approvalType: "ETHICS",
    bundle: "ethics",
    state: {
      editable: editableStatus && !locked,
      inApproval,
      showAddStage: !locked && ["REWORK", "DRFT", "AIA", "WIP"].includes(record.statusCode),
      modifyApprovers: !locked && (inApproval || editableStatus),
      withdraw: record.access === "RESPONDENT_ACCESS" && inApproval &&
        (autoSubmit ? record.creatorPersonId === user.personId : stakeholder.personId === user.personId),
      hasParent: record.access === "APPROVER_ACCESS",
      approveStages: record.access === "APPROVER_ACCESS" && !locked,
    },
    rights: {
      route: right("ethics-approvals"),
      addStage: right("ethics-add-stage"),
      deleteStage: right("ethics-add-stage"),
      addApprover: right("ethics-add-approver"),
      changeApprover: right("ethics-change-approver"),
      removeApprover: right("ethics-change-approver"),
    },
    groupLookup: "APPR_GRP_ADD_STAGE",
  };
}
