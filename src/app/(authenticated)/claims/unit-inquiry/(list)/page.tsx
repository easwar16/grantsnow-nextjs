import { pageIdentity } from "@/server/identity/auth/page";
import { listUnits, unitListView } from "@/server/modules/claims/units/listing";
import { clearedUnitFilters } from "@/features/modules/claims/units/schema";
import { UnitList } from "@/features/modules/claims/units/unit-list";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "Unit Inquiry" };
/** Legacy claims-unit-inquiry-page: the rows stream in after the shell (gates, texts and lookups). */
export default async function UnitInquiry() {
  const { user } = await pageIdentity("/claims/unit-inquiry");
  try {
    serverFunctions.permissions.requireDrawerAccess(
      user,
      "claims-unit-inquiry",
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
  const initial = functions.errors.settle(listUnits(clearedUnitFilters()));
  let view;
  try {
    view = await unitListView();
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Unit Inquiry unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return <UnitList view={view} initial={initial} />;
}
