import { route } from "@/server/http/route";
import {
  deletedDueDiligence,
  restoreDueDiligence,
} from "@/server/modules/due-diligence/recycle";
import { AppError } from "@/lib/errors";
export const GET = route(() => deletedDueDiligence());
export const POST = route(
  async (request) => {
    const body: unknown = await request.json();
    const id =
      typeof body === "object" && body !== null && "id" in body
        ? body.id
        : null;
    if (typeof id !== "string")
      throw new AppError(
        "BAD_REQUEST",
        "Due Diligence application id is required.",
        400,
      );
    return restoreDueDiligence(id);
  },
  { write: true },
);
