import "server-only";
import { z } from "zod";
import { oracle, oracleWrite } from "@/server/api/transport";
import {
  label,
  resourcePreference,
  resources,
  type Resources,
} from "@/server/configuration/resources";
import { displayFormat } from "@/server/configuration/formatting";
import { referenceRead } from "@/server/opportunities/reference";
import { plainText, sanitizeHtml } from "@/server/html/sanitize";
import { dateTimeDisplay } from "@/lib/format";
import { AppError } from "@/lib/errors";
import type { MentionPerson } from "@/lib/mentions";
import {
  COMMENT_LABELS,
  type CommentLabel,
  type CommentsView,
} from "@/features/objects/panel-types";
import { panelHost, type PanelHost } from "./panels";

/**
 * The shared comments panel's server side (legacy `object-comments`): one thread per record page (`module` is the
 * page id), add / edit / delete through `postProposalComments` and `deleteSharedComments`. Edit and delete touch only
 * the user's own comment, re-read from the thread; identity headers come from the session.
 */
/** The fragment's defaults (object-comments-fragment.json `labels`, `maxLength`, `maxLengthWarning`). */
const DEFAULTS: Record<CommentLabel, string> = {
  noData: "No comments yet",
  edit: "Edit",
  delete: "Delete",
  send: "Send",
  cancel: "Cancel",
  submit: "Submit",
  editTitle: "Edit Your Comment",
};
const MAX_LENGTH = 2500;
const WARNING = "Comment must be less than {num} characters";
/** The keys each host passes as `labels` (KB Shared-Features § object-comments label matrix). */
const BUNDLE_KEYS: Record<string, Record<CommentLabel, [string, string]>> = {
  "opportunities-eoi": {
    noData: ["helper-texts", "eoi-no-data"],
    edit: ["button-labels", "eoi-comment-edit"],
    delete: ["button-labels", "eoi-comment-delete"],
    send: ["button-labels", "eoi-comment-save"],
    cancel: ["button-labels", "eoi-comment-cancel"],
    submit: ["button-labels", "eoi-comment-submit"],
    editTitle: ["dialog-titles", "eoi-edit-your-comment"],
  },
};
function settings(rows: Resources, bundle: string) {
  const keys = BUNDLE_KEYS[bundle];
  const maxLength =
    resourcePreference(rows, bundle, "labels", "comments-input", "maxLength") ??
    MAX_LENGTH;
  return {
    labels: Object.fromEntries(
      COMMENT_LABELS.map((name) => [
        name,
        keys
          ? label(rows, bundle, keys[name][0], keys[name][1], DEFAULTS[name])
          : DEFAULTS[name],
      ]),
    ) as Record<CommentLabel, string>,
    maxLength,
    warning: label(
      rows,
      bundle,
      "warning-messages",
      "dynamic-less-than",
      WARNING,
    ).replaceAll("{num}", String(maxLength)),
  };
}

const text = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const threadSchema = z.object({
  items: z.array(
    z.object({
      comment_id: z.coerce.number().int().positive(),
      comments: text,
      created_by: z.union([z.number(), z.string()]).nullish(),
      creation_date: text,
      full_name: text,
      module: text,
    }),
  ),
});
type Row = z.infer<typeof threadSchema>["items"][number];
async function readThread(host: PanelHost) {
  return threadSchema.parse(
    await oracle(
      "getProposalComments",
      { token: host.token },
      new URLSearchParams({ module: host.page, object_id: host.objectId }),
    ),
  ).items;
}
const isOwn = (row: Row, host: PanelHost) =>
  row.created_by !== null &&
  row.created_by !== undefined &&
  String(row.created_by) === host.user.personId;

/** The page's thread as display rows, with the bundle's labels and limit. */
export async function commentsView(q: URLSearchParams): Promise<CommentsView> {
  const [host, rows, format] = await Promise.all([
    panelHost(q, "read"),
    resources(),
    displayFormat(),
  ]);
  const thread = await readThread(host);
  return {
    ...settings(rows, host.bundle),
    canComment: host.canComment,
    items: thread.map((row) => ({
      id: row.comment_id,
      // Legacy renderAsHTML drops the RTE's escaped newlines; sanitizeHtml does the same.
      html: sanitizeHtml(row.comments),
      author: row.full_name,
      at: row.creation_date ? dateTimeDisplay(row.creation_date, format) : "",
      own: isOwn(row, host),
      canChange: host.canComment && isOwn(row, host),
    })),
  };
}

export const commentInput = z.object({ comments: z.string() }).strict();
/** The comment as it is sent: sanitised, non-empty and within the bundle's limit (legacy's length rule). */
async function checkedComment(host: PanelHost, raw: unknown) {
  const { comments } = commentInput.parse(raw);
  const { maxLength, warning } = settings(await resources(), host.bundle);
  const html = sanitizeHtml(comments);
  if (plainText(html).trim() === "" || html.length > maxLength)
    throw new AppError("BAD_REQUEST", warning, 400);
  return html;
}
const writeHeaders = (host: PanelHost) => ({
  legal_id: host.user.legalId ?? "",
  org_id: host.user.organizationId,
  token: host.token,
  user_id: host.user.personId,
});
/** The user's own comment in this page's thread; anything else is refused. */
async function ownComment(host: PanelHost, commentId: number) {
  const row = (await readThread(host)).find((r) => r.comment_id === commentId);
  if (!row)
    throw new AppError("BAD_REQUEST", "The comment was not found.", 404);
  if (!isOwn(row, host))
    throw new AppError(
      "FORBIDDEN",
      "You can only change your own comments.",
      403,
    );
  return row;
}

/** WRITES: a new comment on the page's thread (legacy addComment). */
export async function addComment(q: URLSearchParams, raw: unknown) {
  const host = await panelHost(q, "write");
  const comments = await checkedComment(host, raw);
  await oracleWrite("postProposalComments", writeHeaders(host), {
    module: host.page,
    comments,
    object_id: Number(host.objectId),
  });
  return { saved: true };
}
/** WRITES: the user's own comment, new text (legacy updateComment); its thread key is the row's own. */
export async function updateComment(
  q: URLSearchParams,
  commentId: number,
  raw: unknown,
) {
  const host = await panelHost(q, "write");
  const [comments, row] = await Promise.all([
    checkedComment(host, raw),
    ownComment(host, commentId),
  ]);
  await oracleWrite("postProposalComments", writeHeaders(host), {
    comment_id: row.comment_id,
    comments,
    module: row.module || host.page,
    object_id: Number(host.objectId),
  });
  return { saved: true };
}
/** WRITES: removes the user's own comment (legacy deleteComment sends the row as read). */
export async function deleteComment(q: URLSearchParams, commentId: number) {
  const host = await panelHost(q, "write");
  const row = await ownComment(host, commentId);
  await oracleWrite("deleteSharedComments", writeHeaders(host), {
    comment_id: row.comment_id,
    comments: row.comments,
    module: row.module || host.page,
    object_id: Number(host.objectId),
  });
  return { deleted: true };
}

const peopleSchema = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number().int().positive(),
      full_name: z.string(),
      org_unit_name: text,
      email_address: text,
    }),
  ),
});
/** The @mention feed: the app-level person list (legacy getPreAwardGetPersonListAllADP via transformResponse). */
export async function mentionPeople(
  q: URLSearchParams,
): Promise<MentionPerson[]> {
  const host = await panelHost(q, "write");
  return peopleSchema
    .parse(
      await referenceRead("getPre_awardGetPersonListAll", {
        token: host.token,
      }),
    )
    .items.map((p) => ({
      id: String(p.person_id),
      name: p.full_name,
      detail: p.org_unit_name,
      email: p.email_address,
    }));
}
