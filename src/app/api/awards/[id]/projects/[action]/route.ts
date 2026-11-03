import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import {
  cloneCost,
  costDialog,
  deleteCost,
  saveCost,
  saveCostPeriod,
  saveGlobalCosts,
  saveProject,
  saveTeamMember,
} from "@/server/modules/awards/record/projects";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
// A project's or cost line's fields.
const MAX_BODY = 32768;
const invalid = (e: unknown) =>
  e instanceof ZodError || e instanceof SyntaxError
    ? new AppError("BAD_REQUEST", "Invalid request.", 400)
    : e;
const writes: Record<string, (id: string, body: unknown) => Promise<unknown>> =
  {
    project: saveProject,
    team: saveTeamMember,
    global: saveGlobalCosts,
    cost: saveCost,
    period: saveCostPeriod,
    delete: deleteCost,
    clone: cloneCost,
  };
type Context = { params: Promise<{ id: string; action: string }> };
/** The cost dialog's lists: ?type (cost category) and ?line (the line edited). */
export const GET = route<Context>(
  async (request, { params }) => {
    const { id, action } = await params;
    if (action !== "cost")
      throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return costDialog(id, searchOf(request));
  },
  { onError: invalid },
);
/** WRITES: the Projects tab's saves; the record's rules decide on the server. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { id, action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return write(id, JSON.parse(await readText(request, MAX_BODY)));
  },
  { write: true, onError: invalid },
);
