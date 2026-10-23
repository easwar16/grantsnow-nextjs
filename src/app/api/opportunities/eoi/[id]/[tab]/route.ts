import {
  eoiPageLock,
  eoiRecordIdentity,
  eoiRecordRead,
} from "@/server/opportunities/record";
import { workflowView } from "@/server/approvals/workflow";
import { eoiApprovalHost } from "@/server/opportunities/eoi-record/workflow";
import { formOf, isFormTab } from "@/server/opportunities/eoi-record/model";
import {
  summaryView,
  summaryRoles,
} from "@/server/opportunities/eoi-record/opportunity";
import { afterCheck } from "@/server/opportunities/gates";
import { resources } from "@/server/configuration/resources";
import { displayFormat } from "@/server/configuration/formatting";
import { json, failure } from "@/server/api/http";
import { AppError } from "@/lib/errors";
import { attachmentsView } from "@/server/files/attachments";
import { historyView } from "@/server/objects/history";
import { delegationView } from "@/server/objects/delegations";
import {
  eoiDelegationHost,
  eoiHistoryHost,
} from "@/server/opportunities/eoi-record/objects";
/**
 * One tab's read model: the summary view, the Workflow tab's route, the form tab's slot and lock (answers come from the engine),
 * or the Attachments panel's view (its list comes from /api/files).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; tab: string }> },
) {
  try {
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
      return json(
        record.opportunity &&
          summaryView(record.opportunity, rows, roles, format, false),
      );
    }
    if (tab === "application" || isFormTab(tab)) {
      const record = await eoiRecordRead(id, tab);
      return json({
        ...formOf(tab),
        lock: await eoiPageLock(record, tab),
      });
    }
    if (tab === "attachments")
      return json(
        await attachmentsView(
          new URLSearchParams({ host: "eoi", record: id }),
          "eoi-attachments",
        ),
      );
    if (tab === "history")
      return json(await historyView(await eoiHistoryHost(id)));
    if (tab === "delegation")
      return json(await delegationView(await eoiDelegationHost(id)));
    return json(await workflowView(await eoiApprovalHost(id)));
  } catch (error) {
    return failure(error);
  }
}
