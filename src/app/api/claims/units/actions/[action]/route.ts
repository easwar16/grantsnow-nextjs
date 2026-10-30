import { ZodError, z } from "zod";
import { readText } from "@/server/http/body";
import {
  cloneUnit,
  saveUnit,
  unitCloneSetup,
  unitDialogSetup,
  unitFundTypes,
  unitGrants,
} from "@/server/modules/claims/units/actions";
import { route, searchOf } from "@/server/http/route";
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
/** WRITES: create or update a unit application, or clone one. */
export const POST = route<Context>(
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
