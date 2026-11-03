import { listOpportunities } from "@/server/modules/opportunities/service";
import { parseOpportunityQuery } from "@/features/modules/opportunities/schemas";
import { route, searchOf } from "@/server/http/route";
/** One finder page: GET ?q (the tab, filters and offset as JSON); the server builds the SQL. */
export const GET = route((request) =>
  listOpportunities(parseOpportunityQuery(searchOf(request)), request.signal),
);
