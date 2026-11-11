import { route, searchOf } from "@/server/http/route";
import { ethicsLinks } from "@/server/modules/ethics/record";

type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params;
  return ethicsLinks(id, searchOf(request).get("access") ?? undefined);
});
