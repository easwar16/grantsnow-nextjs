import { contractCreatorCard } from "@/server/modules/contracts/creator";
import { route } from "@/server/http/route";
type Context = { params: Promise<{ id: string }> };
/** The contract creator's contact card; record access is checked on the server. */
export const GET = route<Context>(async (_request, context) => {
  const { id } = await context.params;
  return contractCreatorCard(id);
});
