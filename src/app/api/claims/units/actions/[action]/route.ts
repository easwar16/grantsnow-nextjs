import { ZodError, z } from "zod";
import { readText } from "@/server/http/body";
import {
  cloneUnit,
  exportRequest,
  saveUnit,
  unitCloneSetup,
  unitDialogSetup,
  unitFundTypes,
  unitGrants,
} from "@/server/modules/claims/units/actions";
import { fileRoute, route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
// A unit, its year and up to 100 funds.
const MAX_BODY = 65536;
const invalid = (e: unknown) =>
  e instanceof ZodError
    ? new AppError("BAD_REQUEST", "Invalid unit action.", 400)
    : e;
const positive = z.coerce.number().int().positive();
const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  dialog: () => unitDialogSetup(),
  "fund-types": (q) => unitFundTypes(q.get("program") ?? ""),
  grants: (q) =>
    unitGrants(
      positive.parse(q.get("fundType")),
      positive.parse(q.get("year")),
    ),
  clone: () => unitCloneSetup(),
};
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  save: saveUnit,
  clone: cloneUnit,
};
type Context = { params: Promise<{ action: string }> };
/** The listing's dialog setups and the lists they pick from. */
export const GET = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return read(searchOf(request));
  },
  { onError: invalid },
);
/** WRITES (generate-report): the listing's or one application's report, answered as a file. */
const exportFile = fileRoute<Context>(
  async (request) => {
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, 4096));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid export request.", 400);
    }
    return exportRequest(body);
  },
  { write: true },
);
/** WRITES: create or update a unit application, or clone one. */
const write = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    const text = await readText(request, MAX_BODY);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid unit action.", 400);
    }
    return write(body);
  },
  { write: true, onError: invalid },
);
/** WRITES: `export` answers a file; every other action answers JSON. */
export const POST = async (request: Request, context: Context) =>
  (await context.params).action === "export"
    ? exportFile(request, context)
    : write(request, context);
