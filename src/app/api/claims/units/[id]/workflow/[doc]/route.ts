import { readText } from "@/server/http/body";
import {
  workflowRead,
  workflowWrite,
} from "@/server/record/approvals/workflow";
import { unitApprovalHost } from "@/server/modules/claims/units/record/approvals";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 32 * 1024;
type Context = { params: Promise<{ id: string; doc: string }> };
/** A fund's or an amendment's approval route (`fund-<id>` / `amendment-<fund>-<id>`): the route, dialogs, history. */
export const GET = route<Context>(async (request, context) => {
  const { id, doc } = await context.params;
  return workflowRead(await unitApprovalHost(id, doc), searchOf(request));
});
/** One change to the approval route (WRITES); the record's rules and a fresh route read decide, not the browser. */
export const POST = route<Context>(
  async (request, context) => {
    const { id, doc } = await context.params;
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, MAX_BODY));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid workflow request.", 400);
    }
    const result = (await workflowWrite(
      await unitApprovalHost(id, doc),
      body,
    )) as Record<string, unknown> | null;
    // Add Approver toasts the backend's own response_message.
    const message = result?.response_message;
    return typeof message === "string" ? { message } : {};
  },
  { write: true },
);
