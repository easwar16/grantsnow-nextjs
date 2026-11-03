import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { awardListView, listAwards } from "@/server/modules/awards/listing";
import { awardEntryFilters } from "@/features/modules/awards/listing/schema";
import { AwardList } from "@/features/modules/awards/listing/award-list";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "Awards" };
/** Legacy awards-start. `?status&org` are its entry filters (Home's status chart); the rest start from the defaults. */
export default async function Awards({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/awards");
  try {
    serverFunctions.permissions.requireDrawerAccess(user, "awards");
  } catch {
    return (
      <State
        title="Access denied"
        message="You do not have access to this page."
        code="FORBIDDEN"
      />
    );
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams))
    if (typeof v === "string") params.set(k, v);
  const entry = awardEntryFilters(params);
  const formatRead = displayFormat();
  formatRead.catch(() => undefined);
  // The rows stream in after the shell: the listing read can take seconds on DEV and never holds the filters.
  const initial = functions.errors.settle(listAwards(entry));
  let view;
  try {
    view = await awardListView();
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Awards unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <AwardList
      view={view}
      entry={entry}
      initial={initial}
      format={await formatRead}
    />
  );
}
