import "server-only";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { summaryView } from "@/server/modules/claims/funds/record/summary";
import { budgetView } from "@/server/modules/claims/funds/record/budget";
import { claimLinesView } from "@/server/modules/claims/funds/record/claims";
import type { FundRecordFilters, FundTab } from "@/shared/claims/fund-record";
import { functions } from "@/lib/functions";
import { FundBudgetTab, FundClaimsTab, FundSummaryTab } from "./fund-tables";

/** A tab's read, settled so only its failure (never the render) becomes the error state. */
async function settle<T>(read: Promise<T>) {
  return read.then(
    (view) => ({ view }) as const,
    (error: unknown) => ({ error }) as const,
  );
}
function failed(id: string, error: unknown) {
  const e = functions.errors.publicError(error);
  return (
    <State
      id={`${id}-error`}
      title="This page is unavailable"
      message={e.message}
      action={e.action}
      code={e.code}
    />
  );
}

/** One tab of a fund record; the caller has checked the record shows it. */
export async function FundTabContent({
  id,
  tab,
  filters,
}: {
  id: string;
  tab: FundTab;
  filters: FundRecordFilters;
}) {
  if (tab === "attachments")
    return (
      <AttachmentsTab
        host="claim-funds"
        record={id}
        id="claims-fund-attachments"
      />
    );
  const format = displayFormat();
  if (tab === "summary") {
    const [result, f] = await Promise.all([settle(summaryView(id)), format]);
    return "error" in result ? (
      failed("claims-fund-summary", result.error)
    ) : (
      <FundSummaryTab summary={result.view} format={f} />
    );
  }
  if (tab === "budget") {
    const [result, f] = await Promise.all([
      settle(budgetView(id, filters)),
      format,
    ]);
    return "error" in result ? (
      failed("claims-fund-budget", result.error)
    ) : (
      <FundBudgetTab view={result.view} format={f} />
    );
  }
  const [result, f] = await Promise.all([
    settle(claimLinesView(id, filters)),
    format,
  ]);
  return "error" in result ? (
    failed("claims-fund-claims", result.error)
  ) : (
    <FundClaimsTab view={result.view} format={f} />
  );
}
