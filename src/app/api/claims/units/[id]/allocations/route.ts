import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import {
  allocationsView,
  deleteAllocation,
  saveAllocation,
} from "@/server/modules/claims/units/record/allocations";

type Context = { params: Promise<{ id: string }> };
const json = async (request: Request) => {
  try {
    return JSON.parse(await readText(request, 4096)) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid allocation.", 400);
  }
};
/** A fund's Allocation dialog (`?fund=<app_fund_id>`). */
export const GET = route<Context>(async (request, { params }) =>
  allocationsView((await params).id, searchOf(request).get("fund")),
);
/** WRITES: adds an allocation, or updates the one named by `allocId`. */
export const POST = route<Context>(
  async (request, { params }) =>
    saveAllocation((await params).id, await json(request)),
  { write: true },
);
/** WRITES: removes an allocation. */
export const DELETE = route<Context>(
  async (request, { params }) =>
    deleteAllocation((await params).id, await json(request)),
  { write: true },
);
