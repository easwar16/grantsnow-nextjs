import { route, searchOf } from "@/server/http/route";
import { dueDiligenceLinks } from "@/server/modules/due-diligence/record";

type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params;
  return dueDiligenceLinks(id, searchOf(request).get("access") ?? undefined);
});
