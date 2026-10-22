import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import { targetFromQuery } from "@/server/dynamic-form/access";
import { formGlobals } from "@/server/dynamic-form/globals";
import { uploadFile } from "@/server/files/service";
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
/** WRITES a form's file: POST ?objectType&slot&objectId[&parentId], multipart with one `file`. → { attachmentId }. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const target = targetFromQuery(new URL(request.url).searchParams);
    const { maxMb } = await formGlobals();
    const type = request.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data;/i.test(type))
      throw new AppError("BAD_REQUEST", "No file was sent.", 400);
    const body = await readCapped(
      request,
      maxMb * 1024 * 1024 + OVERHEAD,
      maxMb,
    );
    let file: FormDataEntryValue | null;
    try {
      file = (
        await new Response(body, {
          headers: { "content-type": type },
        }).formData()
      ).get("file");
    } catch {
      throw new AppError("BAD_REQUEST", "No file was sent.", 400);
    }
    if (!(file instanceof Blob) || !("name" in file))
      throw new AppError("BAD_REQUEST", "No file was sent.", 400);
    return json(
      await uploadFile(target, {
        name: String(file.name),
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
