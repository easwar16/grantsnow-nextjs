import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { createProposal } from "@/server/modules/proposals/create";

export const POST = route(
  async (request) =>
    createProposal(JSON.parse(await readText(request, 12_000))),
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Proposal details.", 400)
        : error,
  },
);
