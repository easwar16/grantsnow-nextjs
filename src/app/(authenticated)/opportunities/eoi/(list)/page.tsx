import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { eoiListView, listEois } from "@/server/modules/opportunities/eoi";
import { DEFAULT_EOI_FILTERS } from "@/features/modules/opportunities/eoi-list/schema";
import { EoiList } from "@/features/modules/opportunities/eoi-list/eoi-list";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "EOI Application" };
/** Filters are page-scoped (component state), so every visit starts from the defaults, as the original. */
export default async function Eois() {
  const { user } = await pageIdentity("/opportunities/eoi");
  try {
    serverFunctions.permissions.requireDrawerAccess(
      user,
      "opportunities-eoi-list",
    );
  } catch {
    return (
      <State
        title="Access denied"
        message="You do not have access to this page."
        code="FORBIDDEN"
      />
    );
  }
  // The shell waits only for the bundle; the first page streams in beside it.
  const formatRead = displayFormat();
  formatRead.catch(() => undefined);
  const initial = functions.errors.settle(listEois(DEFAULT_EOI_FILTERS));
  let view;
  try {
    view = await eoiListView();
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Applications unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return <EoiList view={view} initial={initial} format={await formatRead} />;
}
