import "server-only";
import { AppError } from "@/lib/errors";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { approvalActor } from "@/server/record/approvals/actor";
import type { ApprovalHost } from "@/server/record/approvals/workflow";
import { dueDiligenceRecord } from "../record";
import { locks as lockApi } from "@/server/oracle/api";
import { globalVariables } from "@/server/platform/configuration/formatting";

/** The VBCS approval-workflow host uses a stakeholder id as its document number. */
export async function dueDiligenceApprovalHost(
  id: string,
  respondentId?: string,
  access?: string,
): Promise<ApprovalHost> {
  const [record, { session, user }] = await Promise.all([
    dueDiligenceRecord(id, access),
    authenticate(),
  ]);
  if (!record.tabs.includes("duediligence-approvals"))
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence Approvals access has not been granted.",
      403,
    );
  const available = record.respondents.filter(
    (row) =>
      record.access !== "RESPONDENT_ACCESS" ||
      row.personId === String(user.personId),
  );
  const respondent = respondentId
    ? available.find((row) => row.id === respondentId)
    : available[0];
  if (!respondent)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this approval.",
      403,
    );
  const pageId = record.rights["duediligence-approvals"]?.pageId;
  let locked = true;
  if (pageId) {
    try {
      const current = z.object({ status: z.string() }).parse(
        await lockApi.lockStatus({
          recordId: respondent.id,
          pageId,
          module: "DUE_DILIGENCE",
        }),
      );
      locked = current.status !== "UNLOCK";
    } catch {
      /* A failed lock read keeps workflow changes disabled. */
    }
  }
  const vars = await globalVariables(session.token).catch(() => []);
  const autoSubmit =
    vars.find((item) => item.var_key === "DUE_DILIGENCE_AUTO_SUBMIT")
      ?.var_value === "Y";
  const rights = record.rights;
  const right = (name: string) => rights[name];
  const status = respondent.statusCode;
  return {
    token: session.token,
    user,
    username: await approvalActor(session, user),
    docNum: respondent.id,
    docType: "DUE_DILIGENCE",
    approvalType: "DUE_DILIGENCE",
    bundle: "due_diligence",
    state: {
      editable: status === "DRFT" && !locked,
      inApproval: status === "AIA",
      showAddStage:
        !locked && ["REWORK", "DRFT", "AIA", "WIP"].includes(record.statusCode),
      modifyApprovers: !locked && ["AIA", "DRFT"].includes(status),
      withdraw:
        record.access === "RESPONDENT_ACCESS" &&
        status === "AIA" &&
        (!autoSubmit || respondent.personId === String(user.personId)),
      hasParent: record.access === "APPROVER_ACCESS",
      approveStages: record.access === "APPROVER_ACCESS" && !locked,
    },
    rights: {
      route: right("duediligence-approvals")?.edit === true,
      addStage: right("due-diligence-add-stage")?.edit === true,
      deleteStage: right("due-diligence-add-stage")?.edit === true,
      addApprover: right("due-diligence-add-approver")?.edit === true,
      changeApprover: right("due-diligence-change-approver")?.edit === true,
      removeApprover: right("due-diligence-change-approver")?.edit === true,
    },
    groupLookup: "APPR_GRP_ADD_STAGE",
  };
}
