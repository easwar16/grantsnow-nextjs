import { fundSummary } from "@/server/modules/claims/funds/actions";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";

const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  summary: (q) => fundSummary(Object.fromEntries(q)),
};
type Context = { params: Promise<{ action: string }> };
/** The listing's dialog setups: a fund's account summary (`?id&year`) for the row's View. */
export const GET = route<Context>(async (request, { params }) => {
  const { action } = await params;
  const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
  if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
  return read(searchOf(request));
});
