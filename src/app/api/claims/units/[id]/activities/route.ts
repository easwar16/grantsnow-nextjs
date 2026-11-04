import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import {
  activitiesView,
  activityListView,
  deleteActivity,
  fundSummaryView,
} from "@/server/modules/claims/units/record/activities";
import {
  activityView,
  amendmentHistoryView,
  claimableView,
  claimDetailsView,
  setActiveVersion,
} from "@/server/modules/claims/units/record/activity";

type Context = { params: Promise<{ id: string }> };
const json = async (request: Request) => {
  try {
    return JSON.parse(await readText(request, 4096)) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid activity.", 400);
  }
};
const DETAIL_VIEWS = {
  activity: activityView,
  claimable: claimableView,
  "amendment-history": amendmentHistoryView,
  "claim-details": claimDetailsView,
} as const;
/**
 * The Activities tab's header (`?fund=`), one of its tables (`?view=fund-summary&period=` / `?view=list&status=`), or
 * one activity version and its sub-tabs (`?view=activity|claimable|amendment-history|claim-details&activity=&version=`).
 */
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params,
    q = searchOf(request);
  const view = q.get("view") ?? "";
  if (view === "fund-summary")
    return fundSummaryView(id, q.get("fund"), q.get("period"));
  if (view === "list")
    return activityListView(id, q.get("fund"), q.get("status"));
  if (view in DETAIL_VIEWS)
    return DETAIL_VIEWS[view as keyof typeof DETAIL_VIEWS](id, {
      fund: q.get("fund"),
      activity: q.get("activity"),
      version: q.get("version"),
    });
  return activitiesView(id, q.get("fund"));
});
/** WRITES: makes an activity version the active one. */
export const POST = route<Context>(
  async (request, { params }) =>
    setActiveVersion((await params).id, await json(request)),
  { write: true },
);
/** WRITES: removes one activity version. */
export const DELETE = route<Context>(
  async (request, { params }) =>
    deleteActivity((await params).id, await json(request)),
  { write: true },
);
