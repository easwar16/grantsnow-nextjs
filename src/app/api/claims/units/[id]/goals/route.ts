import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import {
  deleteGoal,
  goalDialog,
  goalsView,
  saveGoal,
} from "@/server/modules/claims/units/record/goals";

type Context = { params: Promise<{ id: string }> };
const json = async (request: Request) => {
  try {
    return JSON.parse(await readText(request, 16384)) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid goal.", 400);
  }
};
/** The Goals tab (`?fund=`), or its add / edit dialog (`?view=dialog&fund=&goal=&year=`). */
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params,
    q = searchOf(request);
  return q.get("view") === "dialog"
    ? goalDialog(id, {
        fund: q.get("fund"),
        goal: q.get("goal"),
        year: q.get("year"),
      })
    : goalsView(id, q.get("fund"));
});
/** WRITES: adds a goal, or updates the one named by `goal`. */
export const POST = route<Context>(
  async (request, { params }) =>
    saveGoal((await params).id, await json(request)),
  { write: true },
);
/** WRITES: removes a goal. */
export const DELETE = route<Context>(
  async (request, { params }) =>
    deleteGoal((await params).id, await json(request)),
  { write: true },
);
