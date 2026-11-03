import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import {
  quickCostOptions,
  saveQuickCost,
} from "@/server/modules/proposals/quick-cost";

type Context = { params: Promise<{ type: string; id: string }> };

export const GET = route<Context>(async (request, context) => {
  const { type, id } = await context.params;
  return quickCostOptions(type, id, searchOf(request).get("kind") ?? "quick");
});

export const POST = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return saveQuickCost(type, id, JSON.parse(await readText(request, 20_000)));
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Quick Cost.", 400)
        : error,
  },
);
