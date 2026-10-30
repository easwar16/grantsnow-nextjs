import { route } from "@/server/http/route";
import { proposalViability } from "@/server/modules/proposals/viability";

type Context = { params: Promise<{ type: string; id: string }> };
export const GET = route<Context>(async (_request, context) => {
  const { type, id } = await context.params;
  return proposalViability(type, id);
});
