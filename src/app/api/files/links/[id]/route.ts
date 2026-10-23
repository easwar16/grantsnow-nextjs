import { AppError } from "@/lib/errors";
import { deleteLink } from "@/server/record/attachments/attachments";
import { route, searchOf } from "@/server/http/route";
type Context = { params: Promise<{ id: string }> };
/** WRITES: removes one of a host record's links: DELETE /api/files/links/{linkId}?host&record. */
export const DELETE = route<Context>(
  async (request, context) => {
    const { id } = await context.params;
    if (!/^[1-9]\d{0,14}$/.test(id))
      throw new AppError("BAD_REQUEST", "Invalid link.", 400);
    return deleteLink(searchOf(request), Number(id));
  },
  { write: true },
);
