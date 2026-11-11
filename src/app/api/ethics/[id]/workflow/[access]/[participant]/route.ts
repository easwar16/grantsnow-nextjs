import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { ethicsApprovalHost } from "@/server/modules/ethics/approval";
import { workflowRead, workflowWrite } from "@/server/record/approvals/workflow";

type Context = { params: Promise<{ id: string; access: string; participant: string }> };
const hostOf = (id: string, access: string, participant: string) =>
  ethicsApprovalHost(id, participant, access);
export const GET = route<Context>(async (request, context) => {
  const { id, access, participant } = await context.params;
  return workflowRead(await hostOf(id, access, participant), searchOf(request));
});
export const POST = route<Context>(async (request, context) => {
  const { id, access, participant } = await context.params;
  let body: unknown;
  try { body = JSON.parse(await readText(request, 32 * 1024)); }
  catch { throw new AppError("BAD_REQUEST", "Invalid workflow request.", 400); }
  const result = await workflowWrite(await hostOf(id, access, participant), body) as Record<string, unknown> | null;
  return typeof result?.response_message === "string" ? { message: result.response_message } : {};
}, { write: true });
