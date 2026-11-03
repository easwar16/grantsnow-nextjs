import "server-only";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import type { HistoryHost } from "@/server/record/objects/history";
import { proposalPage } from "./record";

export async function proposalHistoryHost(
  type: RecordIdentity["type"],
  id: string,
): Promise<HistoryHost> {
  const context = await proposalPage(type, id, "proposals-history");
  return {
    token: context.session.token,
    user: context.user,
    objectType: type,
    objectId: id,
    objectNumber: context.summary.reference,
    approvalType: type,
    bundle: context.bundle,
    statusLookup: "PROPOSAL_STATUS",
    statusCode: context.summary.statusCode,
    rights: { addStatus: false, abandon: false },
    keys: {
      title: ["header-labels", "proposal-status-history"],
      status: ["labels", "proposal-status"],
      mode: ["labels", "process-mode"],
      comments: ["labels", "comments"],
      user: ["labels", "user"],
      date: ["labels", "date"],
    },
  };
}
