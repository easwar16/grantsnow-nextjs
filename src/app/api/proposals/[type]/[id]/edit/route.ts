import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { saveProposalEdit } from "@/server/modules/proposals/edit";

type Context = { params: Promise<{ type: string; id: string }> };

export const POST = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return saveProposalEdit(
      type,
      id,
      JSON.parse(await readText(request, 12_000)),
    );
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Proposal edit.", 400)
        : error,
  },
);
