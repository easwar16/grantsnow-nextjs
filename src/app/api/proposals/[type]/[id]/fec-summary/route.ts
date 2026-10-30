import { ZodError } from "zod";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { proposalCostingAnalysis } from "@/server/modules/proposals/ai";

type Context = { params: Promise<{ type: string; id: string }> };
export const POST = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return proposalCostingAnalysis(type, id, await request.json());
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError
        ? new AppError("BAD_REQUEST", "Invalid analysis request.", 400)
        : error,
  },
);
