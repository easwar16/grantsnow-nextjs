import { route, searchOf } from "@/server/http/route";
import { ethicsVersions } from "@/server/modules/ethics/record/versions";

type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params;
  return ethicsVersions(id, searchOf(request).get("access") ?? undefined);
});
