import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import type {
  FundClaimLineRow,
  FundTableView,
} from "@/features/modules/claims/funds/types";
import type { FundRecordFilters } from "@/shared/claims/fund-record";
import { label, numberish, optionalText, str } from "../listing";
import { fundRecordRead, resolvedFilters } from "../record";
import { amount } from "./summary";

const lineRow = z.object({
  claim_number: numberish,
  claim_period_month_name: optionalText,
  claim_date: optionalText,
  line_status_descr: optionalText,
  expenditure_amount: numberish,
  expenditure_descr: optionalText,
});

/** The Claims tab (legacy claims-funds-claims loadClaimLines): claim lines for a function, object and status. */
export async function claimLinesView(
  id: string,
  filters: FundRecordFilters,
): Promise<FundTableView<FundClaimLineRow>> {
  const [, rows, f] = await Promise.all([
    fundRecordRead(id, "claims"),
    resources(),
    resolvedFilters(filters),
  ]);
  const items = z.object({ items: z.array(lineRow) }).parse(
    await claims.claimLinesSummary({
      appFundId: Number(id),
      functionCode: f.func,
      objectCode: f.object,
      status: f.status,
    }),
  ).items;
  const h = (key: string, fallback: string) =>
    label(rows, "table-headers", key, fallback);
  return {
    headers: {
      number: h("claim-number", "Claim Number"),
      period: h("claim-period", "Claim Period"),
      date: h("claim-date", "Claim Date"),
      status: h("claim-status", "Status"),
      amount: h("claim-amount", "Amount"),
      description: h("claim-description", "Description"),
    },
    empty: label(rows, "helper-texts", "no-data", "No data to display."),
    rows: items.map((r, i) => ({
      key: String(i),
      number: str(r.claim_number),
      period: r.claim_period_month_name ?? "",
      date: r.claim_date ?? "",
      status: r.line_status_descr ?? "",
      amount: amount(r.expenditure_amount),
      description: r.expenditure_descr ?? "",
    })),
  };
}
