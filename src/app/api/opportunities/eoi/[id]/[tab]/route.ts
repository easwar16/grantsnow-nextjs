import {
  eoiRecordIdentity,
  eoiRecordForms,
  eoiRecordTable,
  eoiSummary,
} from "@/server/opportunities/record";
import { json, failure } from "@/server/api/http";
import { AppError } from "@/lib/errors";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; tab: string }> },
) {
  try {
    const parsed = eoiRecordIdentity.safeParse(await context.params);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid application page.", 400);
    const { id, tab } = parsed.data;
    if (tab === "summary") return json(await eoiSummary(id));
    if (tab === "application" || tab.startsWith("dynamic-form-"))
      return json(
        await eoiRecordForms(
          id,
          tab as "application" | `dynamic-form-${1 | 2 | 3 | 4 | 5}`,
        ),
      );
    return json(
      await eoiRecordTable(
        id,
        tab as "attachments" | "approvals" | "delegation" | "history",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
