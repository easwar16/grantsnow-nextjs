import "server-only";
import { AppError } from "@/lib/errors";

/** The body as text, read at most `max` bytes: a larger or chunked body is refused before it is buffered. */
export async function readText(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AppError("BAD_REQUEST", "Request is too large.", 413);
    }
    chunks.push(part.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

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
/**
 * A multipart body with at most one `file` (bounded by the configured size) and its string fields. `required`
 * refuses a body without a file.
 */
export async function readUpload(
  request: Request,
  maxMb: number,
  required = true,
) {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;/i.test(type))
    throw new AppError("BAD_REQUEST", "No file was sent.", 400);
  const body = await readCapped(request, maxMb * 1024 * 1024 + OVERHEAD, maxMb);
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": type },
    }).formData();
  } catch {
    throw new AppError("BAD_REQUEST", "No file was sent.", 400);
  }
  const file = form.get("file");
  const sent =
    file instanceof Blob && "name" in file
      ? {
          name: String(file.name),
          type: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }
      : null;
  if (required && !sent)
    throw new AppError("BAD_REQUEST", "No file was sent.", 400);
  const fields = Object.fromEntries(
    [...form.entries()].filter(
      ([key, value]) => key !== "file" && typeof value === "string",
    ),
  ) as Record<string, string>;
  return { file: sent, fields };
}
