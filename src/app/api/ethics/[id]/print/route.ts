import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route, fileRoute, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { ethicsRecord } from "@/server/modules/ethics/record";
import { ethicsPrintOptions, printEthics } from "@/server/modules/ethics/print";

type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params;
  const query = searchOf(request);
  const record = await ethicsRecord(id, query.get("access") ?? undefined);
  return ethicsPrintOptions(record, query.get("participant") ?? "");
});
export const POST = fileRoute<Context>(async (request, { params }) => {
  const { id } = await params;
  return printEthics(id, JSON.parse(await readText(request, 2048)));
}, { write: true, onError: (error) => error instanceof ZodError || error instanceof SyntaxError
  ? new AppError("BAD_REQUEST", "Invalid print request.", 400) : error });
