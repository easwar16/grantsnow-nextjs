import { pageIdentity } from "@/server/identity/auth/page";
import {
  analyticsTexts,
  opportunityStatistics,
} from "@/server/modules/opportunities/analytics";
import { State } from "@/components/feedback/state";
import { serverFunctions } from "@/server/functions";
import { AnalyticsDashboard } from "@/features/modules/opportunities/analytics/analytics-dashboard";

export const metadata = { title: "Opportunity analytics" };
export default async function Analytics() {
  const { user } = await pageIdentity("/opportunities/analytics");
  try {
    serverFunctions.permissions.requireDrawerAccess(
      user,
      "opportunities-analytics",
    );
  } catch {
    return <State title="Access denied" code="FORBIDDEN" />;
  }
  // Each chart streams in on its own read; the page awaits only its texts.
  const topFunders = opportunityStatistics("TOP_FUNDERS"),
    fundingType = opportunityStatistics("FUNDING_TYPE");
  topFunders.catch(() => undefined);
  fundingType.catch(() => undefined);
  return (
    <AnalyticsDashboard
      texts={await analyticsTexts()}
      topFunders={topFunders}
      fundingType={fundingType}
    />
  );
}
