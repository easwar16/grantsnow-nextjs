import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { recordIdentity } from "@/features/modules/proposals/record";
import { saveGlobalPricingFunder } from "@/server/modules/proposals/pricing";

type Context = { params: Promise<{ type: string; id: string }> };

export const PUT = route<Context>(
  async (request, context) => {
    const identity = recordIdentity.parse(await context.params);
    return saveGlobalPricingFunder(
      identity.type,
      identity.id,
      JSON.parse(await readText(request, 3_000)),
    );
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Global Funder Values change.", 400)
        : error,
  },
);
