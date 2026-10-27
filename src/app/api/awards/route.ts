import { listAwards } from "@/server/modules/awards/listing";
import { parseAwardFilters } from "@/features/modules/awards/listing/schema";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
/** One page of the Awards listing from structured filters; the server builds the SQL and checks every gate. */
export const GET = route((request) => {
  let filters;
  try {
    filters = parseAwardFilters(searchOf(request));
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid award filters.", 400);
  }
  return listAwards(filters, request.signal);
});
