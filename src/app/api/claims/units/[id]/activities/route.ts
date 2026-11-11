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
import {
  activityEditSetup,
  saveActivity,
} from "@/server/modules/claims/units/record/activity-edit";
import {
  deleteEquipment,
  equipmentView,
  saveEquipment,
} from "@/server/modules/claims/units/record/equipment";
import {
  deleteRoster,
  rosterTitles,
  rosterView,
  saveRoster,
} from "@/server/modules/claims/units/record/roster";
import {
  requirementsView,
  saveRequirement,
} from "@/server/modules/claims/units/record/requirements";
import {
  amendmentLinesView,
  amendmentsView,
  deleteAmendment,
  includeActivities,
  includeView,
  saveAmendment,
} from "@/server/modules/claims/units/record/amendments";

type Context = { params: Promise<{ id: string }> };
const json = async (request: Request, limit = 4096) => {
  try {
    return JSON.parse(await readText(request, limit)) as unknown;
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
  if (view === "edit")
    return activityEditSetup(id, {
      fund: q.get("fund") ?? undefined,
      activity: q.get("activity") ?? undefined,
      version: q.get("version") ?? undefined,
      amendment: q.get("amendment") ?? undefined,
      reason: q.get("reason") ?? undefined,
    });
  if (view === "equipment") return equipmentView(id);
  if (view === "roster") return rosterView(id);
  if (view === "requirements") return requirementsView(id, q.get("fund"));
  if (view === "roster-titles") return rosterTitles(id, q.get("fund"));
  if (view === "amendments")
    return amendmentsView(id, q.get("fund"), q.get("status"));
  if (view === "amendment-lines")
    return amendmentLinesView(id, q.get("fund"), q.get("amendment"));
  if (view === "include")
    return includeView(id, q.get("fund"), q.get("amendment"));
  if (view in DETAIL_VIEWS)
    return DETAIL_VIEWS[view as keyof typeof DETAIL_VIEWS](id, {
      fund: q.get("fund"),
      activity: q.get("activity"),
      version: q.get("version"),
    });
  return activitiesView(id, q.get("fund"));
});
/** WRITES: `?action=save` creates or updates an activity (its texts and lines need the larger body); else makes a version the active one. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { id } = await params;
    const action = searchOf(request).get("action");
    if (action === "save") return saveActivity(id, await json(request, 65536));
    if (action === "include")
      return includeActivities(id, await json(request, 16384));
    if (action === "save-amendment")
      return saveAmendment(id, await json(request));
    if (action === "save-equipment")
      return saveEquipment(id, await json(request, 16384));
    if (action === "save-roster") return saveRoster(id, await json(request));
    if (action === "save-requirement")
      return saveRequirement(id, await json(request));
    return setActiveVersion(id, await json(request));
  },
  { write: true },
);
/** WRITES: removes one activity version; `?action=amendment` removes an amendment (or, with `version`, one line). */
export const DELETE = route<Context>(
  async (request, { params }) => {
    const { id } = await params;
    const action = searchOf(request).get("action");
    if (action === "amendment") return deleteAmendment(id, await json(request));
    if (action === "equipment") return deleteEquipment(id, await json(request));
    if (action === "roster") return deleteRoster(id, await json(request));
    return deleteActivity(id, await json(request));
  },
  { write: true },
);
