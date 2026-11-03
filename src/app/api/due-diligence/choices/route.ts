import { route, searchOf } from "@/server/http/route";
import { dueDiligenceChoices } from "@/server/modules/due-diligence/listing";

export const GET = route((request) => {
  const search = searchOf(request);
  return dueDiligenceChoices(
    search.get("kind") ?? "",
    search.get("access") ?? undefined,
  );
});
