import { route, searchOf } from "@/server/http/route";
import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import {
  cloneDueDiligence,
  deleteDueDiligence,
  dueDiligenceCloneOptions,
} from "@/server/modules/due-diligence/actions";

const json = async (request: Request) => JSON.parse(await readText(request, 32768)) as unknown;
const invalid = (error: unknown) =>
  error instanceof ZodError || error instanceof SyntaxError
    ? new AppError("BAD_REQUEST", "Invalid Due Diligence action.", 400)
    : error;
export const GET = route((request) => {
  const q = searchOf(request);
  return dueDiligenceCloneOptions(q.get("id") ?? "", q.get("access") ?? "");
}, { onError: invalid });
export const POST = route(async (request) => cloneDueDiligence(await json(request)), { write: true, onError: invalid });
export const DELETE = route(async (request) => deleteDueDiligence(await json(request)), { write: true, onError: invalid });
