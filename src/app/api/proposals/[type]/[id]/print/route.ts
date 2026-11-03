import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { fileRoute } from "@/server/http/route";
import { printProposal } from "@/server/modules/proposals/print";

type Context = { params: Promise<{ type: string; id: string }> };
/** WRITES (generate-report): the chosen Print report as a file. */
export const POST = fileRoute<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const input = JSON.parse(await readText(request, 1024));
    return printProposal(type, id, input);
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid print request.", 400)
        : error,
  },
);
