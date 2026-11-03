import { listFunds } from "@/server/modules/claims/funds/listing";
import { parseFundFilters } from "@/features/modules/claims/funds/schema";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
/** One page of the Funds Inquiry listing from structured filters. */
export const GET = route((request) => {
  let filters;
  try {
    filters = parseFundFilters(searchOf(request));
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid fund filters.", 400);
  }
  return listFunds(filters, request.signal);
});
