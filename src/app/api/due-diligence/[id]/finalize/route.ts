import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { setDueDiligenceFinalized } from "@/server/modules/due-diligence/finalize";

type Context = { params: Promise<{ id: string }> };
export const POST = route<Context>(async (request, { params }) => {
  const { id } = await params;
  return setDueDiligenceFinalized(id, JSON.parse(await readText(request, 2048)));
}, { write: true, onError: (error) => error instanceof ZodError || error instanceof SyntaxError
  ? new AppError("BAD_REQUEST", "Invalid finalize request.", 400) : error });
