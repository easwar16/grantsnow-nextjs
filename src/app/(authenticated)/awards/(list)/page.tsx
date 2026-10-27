import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { requireDrawerAccess } from "@/server/platform/permissions";
import { awardListView, listAwards } from "@/server/modules/awards/listing";
import { awardEntryFilters } from "@/features/modules/awards/listing/schema";
import {
  AwardList,
  type AwardListResult,
} from "@/features/modules/awards/listing/award-list";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
export const metadata = { title: "Awards" };
/** Legacy awards-start. `?status&org` are its entry filters (Home's status chart); the rest start from the defaults. */
export default async function Awards({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/awards");
  try {
    requireDrawerAccess(user, "awards");
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
  const [view, page] = await Promise.allSettled([
    awardListView(),
    listAwards(entry),
  ]);
  if (view.status === "rejected") {
    const e = publicError(view.reason);
    return (
      <State
        title="Awards unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  let initial: AwardListResult;
  if (page.status === "fulfilled") initial = { ok: true, data: page.value };
  else {
    const { code, message, action } = publicError(page.reason);
    initial = { ok: false, error: { code, message, action } };
  }
  return (
    <AwardList
      view={view.value}
      entry={entry}
      initial={initial}
      format={await formatRead}
    />
  );
}
