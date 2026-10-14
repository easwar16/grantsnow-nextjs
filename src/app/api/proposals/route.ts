import { authenticate } from "@/server/session/service";
import { requireModule } from "@/server/permissions/policy";
import { resources, proposalColumns } from "@/server/configuration/resources";
import { listProposals } from "@/server/proposals/service";
import { parseQuery } from "@/features/proposals/schemas";
import { failure, json } from "@/server/api/http";
export async function GET(request: Request) {
  try {
    const { user } = await authenticate();
    requireModule(user, "PROPOSALS");
    const columns = proposalColumns(await resources());
    return json(
      await listProposals(
        parseQuery(new URL(request.url).searchParams),
        columns,
        request.signal,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
