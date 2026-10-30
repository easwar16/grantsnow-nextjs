import "server-only";
import { functions } from "@/lib/functions";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function failure(e: unknown) {
  const { status, ...error } = functions.errors.publicError(e);
  return json({ error }, status);
}
/** A generated or stored file as a download (the name in both Content-Disposition forms); never cached. */
export function fileResponse(file: {
  bytes: Uint8Array;
  mime: string;
  filename: string;
}) {
  const ascii = file.filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new Response(Uint8Array.from(file.bytes) as BodyInit, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
