import { route, searchOf } from "@/server/http/route";
import { parseDueDiligenceFilters } from "@/features/modules/due-diligence/listing/schema";
import { listDueDiligence } from "@/server/modules/due-diligence/listing";

export const GET = route((request) =>
  listDueDiligence(parseDueDiligenceFilters(searchOf(request)), request.signal),
);
