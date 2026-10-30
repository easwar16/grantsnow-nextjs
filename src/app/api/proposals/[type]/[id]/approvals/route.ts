import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalApprovalHost } from "@/server/modules/proposals/approval";
import { stageUsers, workflowView } from "@/server/record/approvals/workflow";

export const GET = route<{ params: Promise<{ type: string; id: string }> }>(
  async (request, context) => {
    const identity = recordIdentity.safeParse(await context.params);
    if (!identity.success)
      throw new AppError("BAD_REQUEST", "Invalid proposal identity.", 400);
    const host = await proposalApprovalHost(
      identity.data.type,
      identity.data.id,
    );
    const query = new URL(request.url).searchParams;
    const view = query.get("view");
    if (view === "users") return stageUsers(host, query.get("stage"));
    if (view === null) return workflowView(host);
    throw new AppError("BAD_REQUEST", "Invalid approval view.", 400);
  },
);
