import { pageIdentity } from "@/server/identity/auth/page";
import { dueDiligenceListView } from "@/server/modules/due-diligence/listing";
import { DueDiligenceList } from "@/features/modules/due-diligence/listing/due-diligence-list";
import { State } from "@/components/feedback/state";
import { parseDueDiligenceFilters } from "@/features/modules/due-diligence/listing/schema";

export const metadata = { title: "Due Diligence" };

export default async function DueDiligence({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pageIdentity("/due-diligence");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === "string") params.set(key, value);
  let filters;
  try {
    filters = parseDueDiligenceFilters(params);
  } catch {
    return (
      <State
        title="Invalid filters"
        message="Open Due Diligence from the navigation to reset the query."
        code="BAD_REQUEST"
      />
    );
  }
  const view = await dueDiligenceListView().catch(() => null);
  if (!view)
    return (
      <State
        title="Due Diligence unavailable"
        message="Please retry or contact your administrator."
        code="UPSTREAM"
      />
    );
  if (!view.tabs.length)
    return (
      <State
        title="Access denied"
        message="Due Diligence listing access has not been granted."
        code="FORBIDDEN"
      />
    );
  return (
    <DueDiligenceList
      key={params.toString()}
      view={view}
      initialFilters={filters}
    />
  );
}
