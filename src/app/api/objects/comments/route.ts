import { addComment, commentsView } from "@/server/objects/comments";
import { badComment, commentBody } from "@/server/objects/request";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
/** The page's thread: GET ?type&id&page. */
export async function GET(request: Request) {
  try {
    return json(await commentsView(new URL(request.url).searchParams));
  } catch (e) {
    return failure(e);
  }
}
/** WRITES a comment: POST ?type&id&page with `{ comments }`. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    return json(
      await addComment(
        new URL(request.url).searchParams,
        await commentBody(request),
      ),
    );
  } catch (e) {
    return failure(badComment(e));
  }
}
