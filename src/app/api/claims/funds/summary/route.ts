import { fundSummary } from "@/server/modules/claims/funds/actions";
import { route, searchOf } from "@/server/http/route";
/** A fund's account summary (`?id&year`), for the listing's View. */
export const GET = route((request) =>
  fundSummary(Object.fromEntries(searchOf(request))),
);
