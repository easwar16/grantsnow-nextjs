import { json, failure } from "@/server/api/http";
import { attributesQuery, loadAttributes } from "@/server/attributes/service";
/** A host's object attributes: ?host&parentId&objectId (the panel's values travel in the host's own save). */
export async function GET(request: Request) {
  try {
    return json(
      await loadAttributes(attributesQuery(new URL(request.url).searchParams)),
    );
  } catch (e) {
    return failure(e);
  }
}
