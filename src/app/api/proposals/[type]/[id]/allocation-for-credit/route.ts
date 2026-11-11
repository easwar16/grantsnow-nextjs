import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { saveProposalCreditAllocation } from "@/server/modules/proposals/credit-allocation";

type Context = { params: Promise<{ type: string; id: string }> };

export const PUT = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return saveProposalCreditAllocation(
      type,
      id,
      JSON.parse(await readText(request, 20_000)),
    );
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Credit Allocation.", 400)
        : error,
  },
);
