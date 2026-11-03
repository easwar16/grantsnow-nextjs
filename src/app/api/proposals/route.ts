import { authenticate } from "@/server/identity/session/service";
import { resources } from "@/server/platform/configuration/resources";
import { listProposals } from "@/server/modules/proposals/service";
import { parseQuery } from "@/features/modules/proposals/schemas";
import { route, searchOf } from "@/server/http/route";
import { serverFunctions } from "@/server/functions";
export const GET = route(async (request) => {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  const columns = serverFunctions.resources.proposalColumns(await resources());
  return listProposals(parseQuery(searchOf(request)), columns, request.signal);
});
