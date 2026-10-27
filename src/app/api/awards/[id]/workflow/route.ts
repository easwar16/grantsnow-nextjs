import { readText } from "@/server/http/body";
import {
  workflowRead,
  workflowWrite,
} from "@/server/record/approvals/workflow";
import { awardApprovalHost } from "@/server/modules/awards/record/objects";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 32 * 1024;
type Context = { params: Promise<{ id: string }> };
/** The Workflow tab's reads: the route (default), a stage's approvers, the Add Stage setup, people or groups. */
export const GET = route<Context>(async (request, context) => {
  const { id } = await context.params;
  const host = await awardApprovalHost(id);
  return workflowRead(host, searchOf(request));
});
/** One change to the approval route (WRITES); the record's rules and a fresh route read decide, not the browser. */
export const POST = route<Context>(
  async (request, context) => {
    const { id } = await context.params;
    const text = await readText(request, MAX_BODY);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid workflow request.", 400);
    }
    const host = await awardApprovalHost(id);
    const result = (await workflowWrite(host, body)) as Record<
      string,
      unknown
    > | null;
    // Add Approver toasts the backend's own response_message (SelectValueItemChangeChain).
    const message = result?.response_message;
    return typeof message === "string" ? { message } : {};
  },
  { write: true },
);
