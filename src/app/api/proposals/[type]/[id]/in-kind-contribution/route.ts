import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import {
  addInKindLine,
  removeInKindLine,
  saveInKindLine,
  saveInKindTotals,
} from "@/server/modules/proposals/in-kind";

type Context = { params: Promise<{ type: string; id: string }> };
const error = (cause: unknown) =>
  cause instanceof ZodError || cause instanceof SyntaxError
    ? new AppError("BAD_REQUEST", "Invalid In-kind Contribution.", 400)
    : cause;

export const PUT = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const body = JSON.parse(await readText(request, 20_000));
    if (body?.action === "totals") return saveInKindTotals(type, id, body.data);
    if (body?.action === "line") return saveInKindLine(type, id, body.data);
    if (body?.action === "add") return addInKindLine(type, id, body.data);
    throw new AppError("BAD_REQUEST", "Invalid In-kind action.", 400);
  },
  { write: true, onError: error },
);

export const DELETE = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const body = JSON.parse(await readText(request, 2_000));
    return removeInKindLine(type, id, Number(body?.id));
  },
  { write: true, onError: error },
);
