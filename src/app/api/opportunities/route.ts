import { listOpportunities } from "@/server/opportunities/service";
import { parseOpportunityQuery } from "@/features/opportunities/schemas";
import { failure, json } from "@/server/api/http";
export async function GET(request: Request) {
  try {
    return json(
      await listOpportunities(
        parseOpportunityQuery(new URL(request.url).searchParams),
        request.signal,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
