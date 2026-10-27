import { eoiCreatorCard } from "@/server/modules/opportunities/eoi-record/creator";
import { route } from "@/server/http/route";
type Context = { params: Promise<{ id: string }> };
/** The application creator's contact card; record access is checked on the server. */
export const GET = route<Context>(async (_request, context) => {
  const { id } = await context.params;
  return eoiCreatorCard(id);
});
