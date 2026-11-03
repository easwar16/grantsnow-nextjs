import { listUnits } from "@/server/modules/claims/units/listing";
import { parseUnitFilters } from "@/features/modules/claims/units/schema";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
/** One page of the Unit Inquiry listing from structured filters. */
export const GET = route((request) => {
  let filters;
  try {
    filters = parseUnitFilters(searchOf(request));
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid unit filters.", 400);
  }
  return listUnits(filters, request.signal);
});
