import "server-only";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import type { AttachmentHost } from "@/server/record/attachments/attachments";
import { AppError } from "@/lib/errors";
import { proposalPage } from "./record";

export async function proposalAttachmentHost(
  type: RecordIdentity["type"],
  id: string,
  mode: "read" | "view" | "edit",
): Promise<AttachmentHost> {
  const context = await proposalPage(type, id, "proposals-attachments");
  if (mode === "edit")
    throw new AppError(
      "FORBIDDEN",
      "Proposal attachment editing is unavailable.",
      403,
    );
  return {
    objectType: "PROPOSAL",
    objectId: id,
    objectNumber: context.summary.reference,
    pathSegment: "PROPOSALS",
    bundle: context.bundle,
    token: context.session.token,
    user: context.user,
    canEdit: false,
  };
}
