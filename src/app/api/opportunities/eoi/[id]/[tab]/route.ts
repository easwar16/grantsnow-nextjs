import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import {
  eoiPageLock,
  eoiRecordIdentity,
  eoiRecordRead,
  saveEoiApplication,
} from "@/server/modules/opportunities/record";
import { workflowView } from "@/server/record/approvals/workflow";
import { eoiApprovalHost } from "@/server/modules/opportunities/eoi-record/workflow";
import { formOf, isFormTab } from "@/shared/opportunities/eoi-record";
import {
  summaryView,
  summaryRoles,
} from "@/server/modules/opportunities/eoi-record/opportunity";
import { afterCheck } from "@/server/modules/opportunities/gates";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { attachmentsView } from "@/server/record/attachments/attachments";
import { historyView } from "@/server/record/objects/history";
import { delegationView } from "@/server/record/objects/delegations";
import {
  eoiDelegationHost,
  eoiHistoryHost,
} from "@/server/modules/opportunities/eoi-record/objects";
/**
 * One tab's read model: the summary view, the Workflow tab's route, the form tab's slot and lock (answers come from the engine),
 * or the Attachments panel's view (its list comes from /api/files).
 */
export const GET = route<{ params: Promise<{ id: string; tab: string }> }>(
  async (_request, context) => {
    const parsed = eoiRecordIdentity.safeParse(await context.params);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid application page.", 400);
    const { id, tab } = parsed.data;
    if (tab === "summary") {
      const recordRead = eoiRecordRead(id, tab);
      const [rows, format, roles] = await afterCheck(
        recordRead,
        Promise.all([resources(), displayFormat(), summaryRoles()]),
      );
      const record = await recordRead;
      return (
        record.opportunity &&
        summaryView(record.opportunity, rows, roles, format, false)
      );
    }
    if (tab === "application" || isFormTab(tab)) {
      const record = await eoiRecordRead(id, tab);
      return { ...formOf(tab), lock: await eoiPageLock(record, tab) };
    }
    if (tab === "attachments")
      return attachmentsView(
        new URLSearchParams({ host: "eoi", record: id }),
        "eoi-attachments",
      );
    if (tab === "history") return historyView(await eoiHistoryHost(id));
    if (tab === "delegation")
      return delegationView(await eoiDelegationHost(id));
    return workflowView(await eoiApprovalHost(id));
  },
);
// Twenty attributes of up to 4000 characters each.
const MAX_BODY = 96 * 1024;
/** WRITES: the Application tab's Save (insertRequest as an upsert with the attributes); no other tab writes here. */
export const POST = route<{ params: Promise<{ id: string; tab: string }> }>(
  async (request, context) => {
    const parsed = eoiRecordIdentity.safeParse(await context.params);
    if (!parsed.success || parsed.data.tab !== "application")
      throw new AppError("BAD_REQUEST", "Invalid application request.", 400);
    return saveEoiApplication(
      parsed.data.id,
      JSON.parse(await readText(request, MAX_BODY)),
    );
  },
  {
    write: true,
    onError: (e) =>
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid application request.", 400)
        : e,
  },
);
