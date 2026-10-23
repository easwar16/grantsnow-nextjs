import { workflowRead, workflowWrite } from "@/server/approvals/workflow";
import { eoiApprovalHost } from "@/server/opportunities/eoi-record/workflow";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
const MAX_BODY = 32 * 1024;
/** The Workflow tab's reads: the route (default), a stage's approvers, the Add Stage setup, people or groups. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const host = await eoiApprovalHost(id);
    return json(await workflowRead(host, new URL(request.url).searchParams));
  } catch (e) {
    return failure(e);
  }
}
/** One change to the approval route (WRITES); the record's rules and a fresh route read decide, not the browser. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request, appOrigin());
    const { id } = await context.params;
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 400);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid workflow request.", 400);
    }
    const host = await eoiApprovalHost(id);
    const result = (await workflowWrite(host, body)) as Record<
      string,
      unknown
    > | null;
    // Add Approver toasts the backend's own response_message (SelectValueItemChangeChain).
    const message = result?.response_message;
    return json(typeof message === "string" ? { message } : {});
  } catch (e) {
    return failure(e);
  }
}
