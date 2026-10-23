import { AppError } from "@/lib/errors";
import { targetFromQuery } from "@/server/record/dynamic-form/access";
import { formGlobals } from "@/server/record/dynamic-form/globals";
import { uploadFile } from "@/server/record/attachments/service";
import {
  listAttachments,
  uploadAttachment,
} from "@/server/record/attachments/attachments";
import { route, searchOf } from "@/server/http/route";
// Multipart framing around the one file.
const OVERHEAD = 64 * 1024;
const tooLarge = (maxMb: number) =>
  new AppError("BAD_REQUEST", `File size should be less than ${maxMb}MB`, 413);
/** The body, read only up to `cap` bytes: a larger upload is refused without being buffered. */
async function readCapped(request: Request, cap: number, maxMb: number) {
  if (Number(request.headers.get("content-length") || 0) > cap)
    throw tooLarge(maxMb);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("BAD_REQUEST", "No file was sent.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      // Stop reading; cancelling a FormData-backed stream crashes undici (Node 26), and the rest is discarded anyway.
      reader.releaseLock();
      throw tooLarge(maxMb);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
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
    const type = request.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data;/i.test(type))
      throw new AppError("BAD_REQUEST", "No file was sent.", 400);
    const body = await readCapped(
      request,
      maxMb * 1024 * 1024 + OVERHEAD,
      maxMb,
    );
    let form: FormData;
    try {
      form = await new Response(body, {
        headers: { "content-type": type },
      }).formData();
    } catch {
      throw new AppError("BAD_REQUEST", "No file was sent.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof Blob) || !("name" in file))
      throw new AppError("BAD_REQUEST", "No file was sent.", 400);
    const sent = {
      name: String(file.name),
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    };
    if (target) return uploadFile(target, sent);
    const fields = Object.fromEntries(
      [...form.entries()].filter(
        ([key, value]) => key !== "file" && typeof value === "string",
      ),
    );
    return uploadAttachment(query, fields, sent);
  },
  { write: true },
);
