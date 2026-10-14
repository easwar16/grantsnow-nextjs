import { pageIdentity } from "@/server/auth/page";
import { dashboardConfiguration } from "@/server/configuration/service";
import { resources, label } from "@/server/configuration/resources";
import { AppShell } from "@/components/layout/app-shell";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session } = await pageIdentity("/home");
  const [config, labels] = await Promise.all([
    dashboardConfiguration(),
    resources(),
  ]);
  return (
    <div className={config.theme === "theme-dark" ? "app dark" : "app"}>
      {session.fixture && (
        <div className="fixture-banner">
          DEVELOPMENT FIXTURES — synthetic identity and data; no live Oracle
          connection
        </div>
      )}
      {session.source === "browser-session" && (
        <div className="fixture-banner">
          LOCAL DEV — live Oracle DEV data via captured browser session
        </div>
      )}
      <AppShell
        name={user.name}
        organization={user.organization}
        proposals={user.modules.PROPOSALS === true}
        opportunities={user.modules["opportunities-finder"] === true}
        opportunityApplications={
          user.modules["opportunities-eoi-list"] === true
        }
        opportunityAnalytics={user.modules["opportunities-analytics"] === true}
        homeLabel={label(labels, "dashboard", "page-titles", "home", "Home")}
        proposalsLabel={label(
          labels,
          "dashboard",
          "nav-labels",
          "proposals",
          "Proposals",
        )}
      >
        {children}
      </AppShell>
    </div>
  );
}
