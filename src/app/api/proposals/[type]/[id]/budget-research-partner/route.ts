import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import {
  addResearchPartnerCost,
  researchPartnerCostItems,
  removeResearchPartnerCost,
  saveResearchPartnerCost,
} from "@/server/modules/proposals/record/research-partner-costs";

type Context = { params: Promise<{ type: string; id: string }> };
const error = (cause: unknown) =>
  cause instanceof ZodError || cause instanceof SyntaxError
    ? new AppError("BAD_REQUEST", "Invalid Research Partner cost.", 400)
    : cause;
export const PUT = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const body = JSON.parse(await readText(request, 10_000));
    return body?.action === "add"
      ? addResearchPartnerCost(type, id, body.data)
      : saveResearchPartnerCost(type, id, body);
  },
  { write: true, onError: error },
);
export const GET = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const category = new URL(request.url).searchParams.get("category") ?? "";
    return researchPartnerCostItems(type, id, category);
  },
  { onError: error },
);
export const DELETE = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    const body = JSON.parse(await readText(request, 2_000));
    return removeResearchPartnerCost(type, id, Number(body?.lineId));
  },
  { write: true, onError: error },
);
