import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import { deleteLink } from "@/server/files/attachments";
/** WRITES: removes one of a host record's links: DELETE /api/files/links/{linkId}?host&record. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request, appOrigin());
    const { id } = await context.params;
    if (!/^[1-9]\d{0,14}$/.test(id))
      throw new AppError("BAD_REQUEST", "Invalid link.", 400);
    return json(
      await deleteLink(new URL(request.url).searchParams, Number(id)),
    );
  } catch (e) {
    return failure(e);
  }
}
