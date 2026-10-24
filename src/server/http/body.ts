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
