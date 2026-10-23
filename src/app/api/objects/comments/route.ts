import { addComment, commentsView } from "@/server/record/objects/comments";
import { badComment, commentBody } from "@/server/record/objects/request";
import { route, searchOf } from "@/server/http/route";
/** The page's thread: GET ?type&id&page. */
export const GET = route((request) => commentsView(searchOf(request)));
/** WRITES a comment: POST ?type&id&page with `{ comments }`. */
export const POST = route(
  async (request) => addComment(searchOf(request), await commentBody(request)),
  { write: true, onError: badComment },
);
