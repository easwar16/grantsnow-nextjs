import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import type {
  FundActivityRow,
  FundTableView,
} from "@/features/modules/claims/funds/types";
import type { FundRecordFilters } from "@/shared/claims/fund-record";
import { label, numberish, optionalText, str } from "../listing";
import { fundRecordRead, resolvedFilters } from "../record";
import { amount } from "./summary";

const activityRow = z.object({
  activity_number: numberish,
  activity_type: optionalText,
  status: optionalText,
  approved_cost: numberish,
  itemization_text: optionalText,
  job_title: optionalText,
});

/** The Budget tab (legacy claims-funds-budget loadBudgetDetails): the fund's activities for a function and object. */
export async function budgetView(
  id: string,
  filters: FundRecordFilters,
): Promise<FundTableView<FundActivityRow>> {
  const [, rows, f] = await Promise.all([
    fundRecordRead(id, "budget"),
    resources(),
    resolvedFilters(filters),
  ]);
  const items = z.object({ items: z.array(activityRow) }).parse(
    await claims.activitiesSummary({
      appFundId: Number(id),
      functionCode: f.func,
      objectCode: f.object,
    }),
  ).items;
  const h = (key: string, fallback: string) =>
    label(rows, "table-headers", key, fallback);
  return {
    headers: {
      number: h("activity-number", "Activity Number"),
      type: h("activity-type", "Activity Type"),
      status: h("activity-status", "Status"),
      cost: h("activity-cost", "Approved Cost"),
      itemization: h("activity-itemization-text", "Itemization"),
      job: h("activity-job-description", "Job Description"),
    },
    empty: label(rows, "helper-texts", "no-data", "No data to display."),
    // The backend sends no row key; the position is the row's key, as legacy's ArrayDataProvider.
    rows: items.map((r, i) => ({
      key: String(i),
      number: str(r.activity_number),
      type: r.activity_type ?? "",
      status: r.status ?? "",
      cost: amount(r.approved_cost),
      itemization: r.itemization_text ?? "",
      job: r.job_title ?? "",
    })),
  };
}
