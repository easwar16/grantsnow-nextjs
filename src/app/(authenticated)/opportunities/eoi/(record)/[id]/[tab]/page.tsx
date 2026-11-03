import {
  eoiRecordContext,
  eoiRecordIdentity,
} from "@/server/modules/opportunities/record";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { RecordTabContent } from "@/features/modules/opportunities/eoi/tab-content";
/** One tab of a saved application; a tab the record does not show toasts and goes to Summary (subFlowAccessGuard). */
export default async function EoiTabPage({
  params,
}: {
  params: Promise<{ id: string; tab: string }>;
}) {
  const input = eoiRecordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid application page" code="BAD_REQUEST" />;
  const { id, tab } = input.data;
  let context;
  try {
    context = await eoiRecordContext(id);
  } catch {
    // The layout shows the failure and does not render the tab.
    return null;
  }
  if (!context.tabs.includes(tab)) {
    // Summary unless it is the one denied; the original opened Summary whatever the rights, this fails closed.
    const fallback = context.tabs.includes("summary")
      ? "summary"
      : context.tabs[0];
    return fallback ? (
      <DeniedRedirect
        title="Access denied"
        message="You do not have access to this page."
        href={`/opportunities/eoi/${id}/${fallback}`}
      />
    ) : (
      <DeniedRedirect
        title="Access Denied"
        message="You don't have access to this AOI"
        href="/opportunities/eoi"
      />
    );
  }
  return <RecordTabContent context={context} tab={tab} />;
}
