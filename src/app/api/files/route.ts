import { targetFromQuery } from "@/server/record/dynamic-form/access";
import { formGlobals } from "@/server/record/dynamic-form/globals";
import { uploadFile } from "@/server/record/attachments/service";
import {
  listAttachments,
  uploadAttachment,
} from "@/server/record/attachments/attachments";
import { route, searchOf } from "@/server/http/route";
import { readUpload } from "@/server/http/body";
/** A host record's documents and links (the Attachments panel): GET ?host&record. */
export const GET = route((request) => listAttachments(searchOf(request)));
/**
 * WRITES a file, multipart with one `file`: a form's (?objectType&slot&objectId[&parentId]) → { attachmentId }, or a
 * host record's Attachments panel (?host&record, plus `folder`, `newFolder`, `description`, `confidential`).
 */
export const POST = route(
  async (request) => {
    const query = searchOf(request);
    const panel = query.has("host");
    const target = panel ? null : targetFromQuery(query);
    const { maxMb } = await formGlobals();
    const upload = await readUpload(request, maxMb);
    const sent = upload.file!;
    if (target) return uploadFile(target, sent);
    return uploadAttachment(query, upload.fields, sent);
  },
  { write: true },
);
