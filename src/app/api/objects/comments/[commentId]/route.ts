import { deleteComment, updateComment } from "@/server/objects/comments";
import { badComment, commentBody, commentId } from "@/server/objects/request";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
type Context = { params: Promise<{ commentId: string }> };
/** WRITES the user's own comment: PUT ?type&id&page with `{ comments }`. */
export async function PUT(request: Request, context: Context) {
  try {
    sameOrigin(request, appOrigin());
    const id = commentId((await context.params).commentId);
    return json(
      await updateComment(
        new URL(request.url).searchParams,
        id,
        await commentBody(request),
      ),
    );
  } catch (e) {
    return failure(badComment(e));
  }
}
/** WRITES: deletes the user's own comment (?type&id&page). */
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request, appOrigin());
    const id = commentId((await context.params).commentId);
    return json(await deleteComment(new URL(request.url).searchParams, id));
  } catch (e) {
    return failure(e);
  }
}
