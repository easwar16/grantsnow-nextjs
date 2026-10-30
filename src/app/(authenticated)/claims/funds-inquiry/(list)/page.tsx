import { pageIdentity } from "@/server/identity/auth/page";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { fundListView, listFunds } from "@/server/modules/claims/funds/listing";
import { clearedFundFilters } from "@/features/modules/claims/funds/schema";
import { FundList } from "@/features/modules/claims/funds/fund-list";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "Funds Inquiry" };
/** Legacy claims-funds-inquiry-page: the rows stream in after the shell (gates, texts and lookups). */
export default async function FundsInquiry() {
  const { user } = await pageIdentity("/claims/funds-inquiry");
  try {
    serverFunctions.permissions.requireDrawerAccess(
      user,
      "claims-funds-inquiry",
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
  const formatRead = displayFormat();
  formatRead.catch(() => undefined);
  const initial = functions.errors.settle(listFunds(clearedFundFilters()));
  let view;
  try {
    view = await fundListView();
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Funds Inquiry unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return <FundList view={view} initial={initial} format={await formatRead} />;
}
