import { ZodError } from "zod";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { proposalAi } from "@/server/modules/proposals/ai";

type Context = { params: Promise<{ type: string; id: string }> };
export const GET = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return proposalAi(
      type,
      id,
      new URL(request.url).searchParams.get("kind") ?? "",
    );
  },
  {
    onError: (error) =>
      error instanceof ZodError
        ? new AppError("BAD_REQUEST", "Invalid AI request.", 400)
        : error,
  },
);
