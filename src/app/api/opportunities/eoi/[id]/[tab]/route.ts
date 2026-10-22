import {
  eoiPageLock,
  eoiRecordIdentity,
  eoiRecordRead,
  eoiRecordTable,
} from "@/server/opportunities/record";
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
/** One tab's read model: the summary view, a read table, or the form tab's slot and lock (answers come from the engine). */
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
    return json(await eoiRecordTable(id, tab));
  } catch (error) {
    return failure(error);
  }
}
