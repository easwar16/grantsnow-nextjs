import { route } from "@/server/http/route";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import {
  previewPricingReset,
  savePricingReset,
} from "@/server/modules/proposals/pricing";

type Context = { params: Promise<{ type: string; id: string }> };

const onError = (error: unknown) =>
  error instanceof ZodError
    ? new AppError("CONTRACT", "Oracle returned invalid default pricing data.")
    : error;

export const GET = route<Context>(
  async (_request, context) => {
    const identity = recordIdentity.parse(await context.params);
    return previewPricingReset(identity.type, identity.id);
  },
  { onError },
);

export const POST = route<Context>(
  async (_request, context) => {
    const identity = recordIdentity.parse(await context.params);
    return savePricingReset(identity.type, identity.id);
  },
  { write: true, onError },
);
