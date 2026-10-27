import { creatorCard } from "@/server/modules/awards/record/creator";
import { route } from "@/server/http/route";
type Context = { params: Promise<{ id: string }> };
/** The award PI's contact card; record access is checked on the server. */
export const GET = route<Context>(async (_request, context) => {
  const { id } = await context.params;
  return creatorCard(id);
});
