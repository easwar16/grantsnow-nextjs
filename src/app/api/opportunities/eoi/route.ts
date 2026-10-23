import { listEois } from "@/server/modules/opportunities/eoi";
import { parseEoiFilters } from "@/features/modules/opportunities/eoi-list/schema";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
/** One page of the EOI list from structured filters; the server builds the SQL and checks every gate. */
export const GET = route((request) => {
  let filters;
  try {
    filters = parseEoiFilters(searchOf(request));
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid application filters.", 400);
  }
  return listEois(filters, request.signal);
});
