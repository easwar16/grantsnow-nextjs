import { eoiQuerySchema, listEois } from "@/server/opportunities/eoi";
import { json, failure } from "@/server/api/http";
export async function GET(request: Request) {
  try {
    return json(
      await listEois(
        eoiQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
        request.signal,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
