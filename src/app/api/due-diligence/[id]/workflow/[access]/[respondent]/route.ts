import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { dueDiligenceApprovalHost } from "@/server/modules/due-diligence/approval";
import { workflowRead, workflowWrite } from "@/server/record/approvals/workflow";
type Context = { params: Promise<{ id: string; access: string; respondent: string }> };
const hostOf = async (id: string, access: string, respondent: string) =>
  dueDiligenceApprovalHost(id, respondent, access);
export const GET = route<Context>(async (request, context) => {
  const { id, access, respondent } = await context.params;
  return workflowRead(await hostOf(id, access, respondent), searchOf(request));
});
export const POST = route<Context>(async (request, context) => {
  const { id, access, respondent } = await context.params;
  const text = await readText(request, 32 * 1024);
  let body: unknown;
  try { body = JSON.parse(text); }
  catch { throw new AppError("BAD_REQUEST", "Invalid workflow request.", 400); }
  const result = await workflowWrite(await hostOf(id, access, respondent), body) as Record<string, unknown> | null;
  return typeof result?.response_message === "string" ? { message: result.response_message } : {};
}, { write: true });
