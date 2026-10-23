import { authenticate } from "@/server/identity/session/service";
import { requireModule } from "@/server/platform/permissions";
import {
  resources,
  proposalColumns,
} from "@/server/platform/configuration/resources";
import { listProposals } from "@/server/modules/proposals/service";
import { parseQuery } from "@/features/modules/proposals/schemas";
import { route, searchOf } from "@/server/http/route";
export const GET = route(async (request) => {
  const { user } = await authenticate();
  requireModule(user, "PROPOSALS");
  const columns = proposalColumns(await resources());
  return listProposals(parseQuery(searchOf(request)), columns, request.signal);
});
