import {
  unitRecordContext,
  unitRecordIdentity,
} from "@/server/modules/claims/units/record";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { UnitTabContent } from "@/features/modules/claims/units/record/tab-content";

/** One tab of a unit application; a tab the record does not show goes to Summary (subFlowAccessGuard). */
export default async function UnitTabPage({
  params,
}: {
  params: Promise<{ id: string; tab: string }>;
}) {
  const input = unitRecordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid application page" code="BAD_REQUEST" />;
  const { id, tab } = input.data;
  let context;
  try {
    context = await unitRecordContext(id);
  } catch {
    // The layout shows the failure and does not render the tab.
    return null;
  }
  if (!context.tabs.includes(tab))
    return (
      <DeniedRedirect
        title="Access denied"
        message="You do not have access to this page."
        href={`/claims/unit-inquiry/${id}/summary`}
      />
    );
  return <UnitTabContent id={id} tab={tab} />;
}
