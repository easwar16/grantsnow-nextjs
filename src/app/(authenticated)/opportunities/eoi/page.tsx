import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { requireDrawerAccess } from "@/server/platform/permissions";
import { eoiListView, listEois } from "@/server/modules/opportunities/eoi";
import { DEFAULT_EOI_FILTERS } from "@/features/modules/opportunities/eoi-list/schema";
import {
  EoiList,
  type EoiListResult,
} from "@/features/modules/opportunities/eoi-list/eoi-list";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
export const metadata = { title: "EOI Application" };
/** Filters are page-scoped (component state), so every visit starts from the defaults, as the original. */
export default async function Eois() {
  const { user } = await pageIdentity("/opportunities/eoi");
  try {
    requireDrawerAccess(user, "opportunities-eoi-list");
  } catch {
    return (
      <State
        title="Access denied"
        message="You do not have access to this page."
        code="FORBIDDEN"
      />
    );
  }
  // Both read the cached session and bundle; the first page need not wait for the drawer's choices.
  const formatRead = displayFormat();
  const [view, page] = await Promise.allSettled([
    eoiListView(),
    listEois(DEFAULT_EOI_FILTERS),
  ]);
  if (view.status === "rejected") {
    const e = publicError(view.reason);
    return (
      <State
        title="Applications unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  let initial: EoiListResult;
  if (page.status === "fulfilled") initial = { ok: true, data: page.value };
  else {
    const { code, message, action } = publicError(page.reason);
    initial = { ok: false, error: { code, message, action } };
  }
  return (
    <EoiList view={view.value} initial={initial} format={await formatRead} />
  );
}
