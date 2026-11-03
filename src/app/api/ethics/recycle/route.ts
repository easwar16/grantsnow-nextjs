import { route } from "@/server/http/route";
import { deletedEthics, restoreEthics } from "@/server/modules/ethics/recycle";
import { AppError } from "@/lib/errors";
export const GET = route(() => deletedEthics());
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
        "Ethics application id is required.",
        400,
      );
    return restoreEthics(id);
  },
  { write: true },
);
