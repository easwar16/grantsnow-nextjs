import { readText } from "@/server/http/body";
import { fileRoute, route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import {
  adjustmentView,
  adjustmentsView,
  deleteAdjustment,
  exportAdjustmentLines,
  saveAdjustment,
} from "@/server/modules/claims/units/record/adjustments";
import {
  claimsListView,
  claimsSummaryView,
  claimsView,
  claimEditView,
  claimView,
  cloneClaim,
  rejectedLinesView,
  saveClaim,
  deleteClaim,
  exportClaimLines,
  exportClaims,
} from "@/server/modules/claims/units/record/claims";

type Context = { params: Promise<{ id: string }> };
const json = async (request: Request, limit = 4096) => {
  try {
    return JSON.parse(await readText(request, limit)) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid claim.", 400);
  }
};
/**
 * The Claims tab's header (`?fund=`), one of its tables (`?view=summary&fund=` / `?view=list&fund=&status=`), or one
 * claim (`?view=claim&fund=&claim=`).
 */
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params,
    q = searchOf(request);
  const view = q.get("view") ?? "";
  if (view === "summary") return claimsSummaryView(id, q.get("fund"));
  if (view === "claim") return claimView(id, q.get("fund"), q.get("claim"));
  if (view === "edit")
    return claimEditView(id, q.get("fund"), q.get("claim") ?? "");
  if (view === "adjustments")
    return adjustmentsView(id, q.get("fund"), q.get("claim"));
  if (view === "adjustment")
    return adjustmentView(
      id,
      q.get("fund"),
      q.get("claim"),
      q.get("adjustment") ?? "",
    );
  if (view === "rejected")
    return rejectedLinesView(
      id,
      q.get("fund"),
      q.get("period"),
      q.get("claim"),
    );
  if (view === "list")
    return claimsListView(id, q.get("fund"), q.get("status"));
  return claimsView(id, q.get("fund"));
});
/** WRITES (generate-report): the Claims List's export, answered as a file. */
const exportFile = fileRoute<Context>(
  async (request, { params }) => {
    const { id } = await params;
    // `?action=export` the list; `?action=export&claim=1` one claim's lines.
    const q = searchOf(request);
    return q.get("adjustment")
      ? exportAdjustmentLines(id, await json(request))
      : q.get("claim")
        ? exportClaimLines(id, await json(request))
        : exportClaims(id, await json(request));
  },
  { write: true },
);
/** WRITES: `?action=clone` copies a claim. */
const write = route<Context>(
  async (request, { params }) => {
    const { id } = await params;
    const action = searchOf(request).get("action");
    if (action === "clone") return cloneClaim(id, await json(request));
    if (action === "save") return saveClaim(id, await json(request, 262144));
    if (action === "save-adjustment")
      return saveAdjustment(id, await json(request, 262144));
    throw new AppError("BAD_REQUEST", "Unknown claim action.", 400);
  },
  { write: true },
);
/** WRITES: `?action=export` answers a file; every other action answers JSON. */
export const POST = async (request: Request, context: Context) =>
  searchOf(request).get("action") === "export"
    ? exportFile(request, context)
    : write(request, context);
/** WRITES: removes a claim; `?action=adjustment` removes an adjustment. */
export const DELETE = route<Context>(
  async (request, { params }) => {
    const { id } = await params;
    return searchOf(request).get("action") === "adjustment"
      ? deleteAdjustment(id, await json(request))
      : deleteClaim(id, await json(request));
  },
  { write: true },
);
