import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { savePricingFunder } from "@/server/modules/proposals/pricing";
import { recordIdentity } from "@/features/modules/proposals/record";

type Context = { params: Promise<{ type: string; id: string }> };

export const PUT = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const identity = recordIdentity.parse({ type, id });
    return savePricingFunder(identity.type, identity.id, JSON.parse(await readText(request, 3_000)));
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Funder Rules change.", 400)
        : error,
  },
);
