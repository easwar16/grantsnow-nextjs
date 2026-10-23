import { mentionPeople } from "@/server/objects/comments";
import { json, failure } from "@/server/api/http";
/** The @mention feed for a page the user may comment on: GET ?type&id&page. */
export async function GET(request: Request) {
  try {
    return json(await mentionPeople(new URL(request.url).searchParams));
  } catch (e) {
    return failure(e);
  }
}
