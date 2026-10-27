import {
  awardRecordContext,
  awardRecordIdentity,
} from "@/server/modules/awards/record";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { AwardTabContent } from "@/features/modules/awards/record/tab-content";
/** One tab of an award; a tab the record does not show toasts and goes to the Header (subFlowAccessGuard). */
export default async function AwardTabPage({
  params,
}: {
  params: Promise<{ id: string; tab: string }>;
}) {
  const input = awardRecordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid award page" code="BAD_REQUEST" />;
  const { id, tab } = input.data;
  let context;
  try {
    context = await awardRecordContext(id);
  } catch {
    // The layout shows the failure and does not render the tab.
    return null;
  }
  if (!context.tabs.includes(tab))
    return (
      <DeniedRedirect
        title="Access denied"
        message="You do not have access to this page."
        href={`/awards/${id}/header`}
      />
    );
  return <AwardTabContent context={context} tab={tab} />;
}
