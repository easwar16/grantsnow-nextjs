import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { ethicsAutoSubmit } from "@/server/modules/ethics/record/auto-submit";

type Context = { params: Promise<{ id: string }> };
export const POST = route<Context>(
  async (request, { params }) => {
    const { id } = await params;
    return ethicsAutoSubmit(id, JSON.parse(await readText(request, 2048)));
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Ethics submission.", 400)
        : error,
  },
);
