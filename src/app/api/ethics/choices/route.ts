import { route, searchOf } from "@/server/http/route";
import { ethicsChoices } from "@/server/modules/ethics/listing";

export const GET = route((request) => {
  const search = searchOf(request);
  return ethicsChoices(
    search.get("kind") ?? "",
    search.get("access") ?? undefined,
  );
});
