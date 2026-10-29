import "server-only";
import { z } from "zod";
import { read, write } from "../client";
import { serverConstants } from "@/server/constants";

/**
 * A record's attachment records and external links (`/pre_award/attachments/`, `/pre_award/links`). The bytes live in
 * Object Storage behind the OIC relay, never here. Record data: held for the request only.
 */
const text = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const attachmentRows = z.object({
  items: z.array(
    z.object({
      document_id: z.coerce.number().int().positive(),
      file_name: z.string(),
      file_location: z.string(),
      sec_obj_ref_type: text,
      description: text,
      document_type: text,
      file_size: z.union([z.number(), z.string()]).nullish(),
      created_by_name: text,
      creation_date: text,
    }),
  ),
});
export type AttachmentRow = z.infer<typeof attachmentRows>["items"][number];
type Target = { objectType: string; objectId: string };
/** The record's attachments; `secondaryType` (`p_sec_obj_type`) narrows them to one form slot. */
export const list = read<Target & { secondaryType?: string }, AttachmentRow[]>({
  op: "getPre_awardAttachmentsProposal_id",
  ttl: serverConstants.ttl.access,
  query: (p) => ({
    p_obj_id: p.objectId,
    p_obj_type: p.objectType,
    p_sec_obj_type: p.secondaryType,
  }),
  parse: (b) => attachmentRows.parse(b).items,
});
const linkRows = z.object({
  items: z.array(
    z.object({
      link_id: z.coerce.number().int().positive(),
      link_title: text,
      link_url: text,
    }),
  ),
});
export type LinkRow = z.infer<typeof linkRows>["items"][number];
/** The record's external links. */
export const links = read<Target, LinkRow[]>({
  op: "getPre_awardLinks",
  ttl: serverConstants.ttl.access,
  query: (p) => ({ p_obj_id: p.objectId, p_obj_type: p.objectType }),
  parse: (b) => linkRows.parse(b).items,
});
const identity = ["org_id", "legal_id"] as const;
/** WRITES: an attachment record for stored bytes; `body` is built by the caller's upload rules. */
export const record = write<{ body: unknown }>({
  op: "postPre_awardAttachments",
  identity,
  body: (p) => p.body,
  invalidates: ["getPre_awardAttachmentsProposal_id"],
});
/** WRITES: removes an attachment record (its bytes are deleted first). */
export const remove = write<{ id: number }>({
  op: "deletePre_awardAttachments",
  identity,
  headers: (p) => ({ id: p.id }),
  invalidates: ["getPre_awardAttachmentsProposal_id"],
});
/** WRITES: a new external link; `body` is built by the links rules. */
export const addLink = write<{ body: unknown }>({
  op: "postPre_awardLinks",
  identity,
  body: (p) => p.body,
  invalidates: ["getPre_awardLinks"],
});
/** WRITES: removes a link (its id as a query parameter). */
export const removeLink = write<{ id: number }>({
  op: "deletePre_awardLinks",
  query: (p) => ({ link_id: p.id }),
  invalidates: ["getPre_awardLinks"],
});
