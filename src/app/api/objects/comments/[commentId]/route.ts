import { deleteComment, updateComment } from "@/server/record/objects/comments";
import {
  badComment,
  commentBody,
  commentId,
} from "@/server/record/objects/request";
import { route, searchOf } from "@/server/http/route";
type Context = { params: Promise<{ commentId: string }> };
/** WRITES the user's own comment: PUT ?type&id&page with `{ comments }`. */
export const PUT = route<Context>(
  async (request, context) =>
    updateComment(
      searchOf(request),
      commentId((await context.params).commentId),
      await commentBody(request),
    ),
  { write: true, onError: badComment },
);
/** WRITES: deletes the user's own comment (?type&id&page). */
export const DELETE = route<Context>(
  async (request, context) =>
    deleteComment(
      searchOf(request),
      commentId((await context.params).commentId),
    ),
  { write: true },
);
