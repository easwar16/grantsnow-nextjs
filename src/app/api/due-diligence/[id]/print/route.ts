import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route, fileRoute, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { dueDiligenceRecord } from "@/server/modules/due-diligence/record";
import {
  dueDiligencePrintOptions,
  printDueDiligence,
} from "@/server/modules/due-diligence/record/print";

type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params;
  const query = searchOf(request);
  const record = await dueDiligenceRecord(id, query.get("access") ?? undefined);
  return dueDiligencePrintOptions(record, query.get("respondent") ?? "");
});
export const POST = fileRoute<Context>(
  async (request, { params }) => {
    const { id } = await params;
    return printDueDiligence(id, JSON.parse(await readText(request, 2048)));
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid print request.", 400)
        : error,
  },
);
