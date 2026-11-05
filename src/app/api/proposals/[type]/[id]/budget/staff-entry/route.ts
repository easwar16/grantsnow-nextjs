import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import {
  staffEntryPerson,
  staffEntryAvailability,
  createStaffCostHeader,
  saveStaffCostLines,
} from "@/server/modules/proposals/staff-entry";

type Context = { params: Promise<{ type: string; id: string }> };

export const GET = route<Context>(async (request, context) => {
  const { type, id } = await context.params;
  const query = searchOf(request);
  const personId = Number(query.get("personId"));
  return query.get("action") === "availability"
    ? staffEntryAvailability(type, id, personId)
    : staffEntryPerson(type, id, personId);
});

export const POST = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return createStaffCostHeader(
      type,
      id,
      JSON.parse(await readText(request, 20_000)),
    );
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Staff costing details.", 400)
        : error,
  },
);

export const PUT = route<Context>(
  async (request, context) => {
    const { type, id } = await context.params;
    return saveStaffCostLines(type, id, JSON.parse(await readText(request, 20_000)));
  },
  {
    write: true,
    onError: (error) =>
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid Staff cost lines.", 400)
        : error,
  },
);
