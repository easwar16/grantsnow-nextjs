import { listEois } from "@/server/opportunities/eoi";
import { parseEoiFilters } from "@/features/opportunities/eoi-list/schema";
import { json, failure } from "@/server/api/http";
import { AppError } from "@/lib/errors";
/** One page of the EOI list from structured filters; the server builds the SQL and checks every gate. */
export async function GET(request: Request) {
  try {
    let filters;
    try {
      filters = parseEoiFilters(new URL(request.url).searchParams);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid application filters.", 400);
    }
    return json(await listEois(filters, request.signal));
  } catch (error) {
    return failure(error);
  }
}
