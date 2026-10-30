import "server-only";
import { z } from "zod";
import { reports } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import { fundRecordFilters } from "@/shared/claims/fund-record";
import { fundRecordContext, resolvedFilters } from "../record";

// Legacy exportReport's report per tab; Attachments has none (legacy sent an empty code and failed).
const REPORTS = {
  summary: "report-vbcs-fund-listing",
  budget: "report-vbcs-fund-activity-details",
  claims: "report-vbcs-fund-claim-lines",
} as const;
const exportInput = z
  .object({
    tab: z.enum(["summary", "budget", "claims"]),
    filters: fundRecordFilters,
  })
  .strict();

/** WRITES (generate-report): the current tab's report with the filter bar's values (legacy exportReport). */
export async function exportFund(id: string, raw: unknown) {
  const parsed = exportInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid export request.", 400);
  const context = await fundRecordContext(id);
  if (
    context.access.roles.get("claims-export")?.read !== true ||
    !context.tabs.includes(parsed.data.tab)
  )
    throw new AppError(
      "FORBIDDEN",
      "This action is not enabled for your account.",
      403,
    );
  const f = await resolvedFilters(parsed.data.filters);
  return reports.generate({
    body: serverFunctions.reports.reportPayload(REPORTS[parsed.data.tab], {
      object_type: "CLAIMS",
      app_fund_id: id,
      org_id: context.user.organizationId,
      function_code: f.func,
      object_code: f.object,
      line_status_code: f.status,
    }),
  });
}
