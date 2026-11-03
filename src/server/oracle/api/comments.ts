import "server-only";
import { z } from "zod";
import { read, write } from "../client";

const text = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const rows = z.object({
  items: z.array(
    z.object({
      comment_id: z.coerce.number().int().positive(),
      object_id: z.union([z.number(), z.string()]).nullish(),
      comments: text,
      created_by: z.union([z.number(), z.string()]).nullish(),
      creation_date: text,
      full_name: text,
      module: text,
    }),
  ),
});
export type CommentRow = z.infer<typeof rows>["items"][number];
type Thread = { page: string; objectId: string };
/** A record page's thread (legacy fetchComments: `module` is the page id). */
export const thread = read<Thread, CommentRow[]>({
  op: "getProposalComments",
  query: (p) => ({ module: p.page, object_id: p.objectId }),
  parse: (b) => rows.parse(b).items,
});
const identity = ["legal_id", "org_id", "user_id"] as const;
/** WRITES: a new comment on the thread (legacy addComment). */
export const add = write<Thread & { comments: string }>({
  op: "postProposalComments",
  identity,
  body: (p) => ({
    module: p.page,
    comments: p.comments,
    object_id: Number(p.objectId),
  }),
  invalidates: ["getProposalComments"],
});
/** WRITES: new text for a comment (legacy updateComment); `page` is the row's own thread key. */
export const update = write<Thread & { commentId: number; comments: string }>({
  op: "postProposalComments",
  identity,
  body: (p) => ({
    comment_id: p.commentId,
    comments: p.comments,
    module: p.page,
    object_id: Number(p.objectId),
  }),
  invalidates: ["getProposalComments"],
});
/** WRITES: removes a comment; legacy deleteComment sends the row as it was read. */
export const remove = write<Thread & { commentId: number; comments: string }>({
  op: "deleteSharedComments",
  identity,
  body: (p) => ({
    comment_id: p.commentId,
    comments: p.comments,
    module: p.page,
    object_id: Number(p.objectId),
  }),
  invalidates: ["getProposalComments"],
});
