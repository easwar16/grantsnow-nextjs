import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import { targetFromQuery } from "@/server/dynamic-form/access";
import { deleteFile, downloadFile } from "@/server/files/service";
import {
  deleteAttachment,
  downloadAttachment,
} from "@/server/files/attachments";
type Context = { params: Promise<{ id: string }> };
async function attachmentId(context: Context) {
  const { id } = await context.params;
  if (!/^[1-9]\d{0,14}$/.test(id))
    throw new AppError("BAD_REQUEST", "Invalid file.", 400);
  return Number(id);
}
/** `filename` for ASCII clients, `filename*` (RFC 5987) for the real name. */
function disposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
/**
 * A stored file's bytes: GET /api/files/{attachmentId}?objectType&slot&objectId (a form's) or ?host&record (an
 * Attachments panel's). Always a download, never rendered; the panel's preview builds its own typed blob.
 */
export async function GET(request: Request, context: Context) {
  try {
    const id = await attachmentId(context);
    const query = new URL(request.url).searchParams;
    const { bytes, fileName } = query.has("host")
      ? await downloadAttachment(query, id)
      : await downloadFile(targetFromQuery(query), id);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": disposition(fileName),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
/** WRITES: deletes a stored file and its record. */
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request, appOrigin());
    const id = await attachmentId(context);
    const query = new URL(request.url).searchParams;
    return json(
      query.has("host")
        ? await deleteAttachment(query, id)
        : await deleteFile(targetFromQuery(query), id),
    );
  } catch (e) {
    return failure(e);
  }
}
