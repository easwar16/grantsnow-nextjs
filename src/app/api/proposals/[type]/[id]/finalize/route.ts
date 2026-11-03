import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { setProposalSummaryFinalized } from "@/server/modules/proposals/finalize";

type Context = { params: Promise<{ type: string; id: string }> };
export const POST = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return setProposalSummaryFinalized(
      type,
      id,
      JSON.parse(await readText(request, 1024)),
    );
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid finalize request.", 400)
        : error,
  },
);
