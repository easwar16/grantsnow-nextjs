import { route, searchOf } from "@/server/http/route";
import { parseEthicsFilters } from "@/features/modules/ethics/schema";
import { listEthics } from "@/server/modules/ethics/listing";

export const GET = route((request) =>
  listEthics(parseEthicsFilters(searchOf(request)), request.signal),
);
