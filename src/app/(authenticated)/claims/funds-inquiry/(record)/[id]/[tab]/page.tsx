import {
  fundRecordContext,
  fundRecordIdentity,
} from "@/server/modules/claims/funds/record";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { FundTabContent } from "@/features/modules/claims/funds/record/tab-content";
import { parseFundRecordFilters } from "@/shared/claims/fund-record";

/** One tab of a fund; a tab the record does not show goes to Summary (subFlowAccessGuard). */
export default async function FundTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = fundRecordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid fund page" code="BAD_REQUEST" />;
  const { id, tab } = input.data;
  let context;
  try {
    context = await fundRecordContext(id);
  } catch {
    // The layout shows the failure and does not render the tab.
    return null;
  }
  if (!context.tabs.includes(tab))
    return (
      <DeniedRedirect
        title="Access denied"
        message="You do not have access to this page."
        href={`/claims/funds-inquiry/${id}/summary`}
      />
    );
  return (
    <FundTabContent
      id={id}
      tab={tab}
      filters={parseFundRecordFilters(await searchParams)}
    />
  );
}
