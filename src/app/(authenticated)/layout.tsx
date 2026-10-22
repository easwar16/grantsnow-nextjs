import { pageIdentity } from "@/server/auth/page";
import { dashboardConfiguration } from "@/server/configuration/service";
import { resources, label } from "@/server/configuration/resources";
import { AppShell } from "@/components/layout/app-shell";
import { Navigation } from "@/components/layout/navigation";
import { visibleNavigation } from "@/server/permissions/policy";
import type { NavDefinition, NavEntry } from "@/lib/unavailable-modules";
import { externalToolUrls } from "./modules/external-tools";
import { ChatbotMount } from "@/components/chatbot/chatbot-mount";
type Labels = Awaited<ReturnType<typeof resources>>;
/** Allowlisted display model: labels from RB `module-name` (VBCS applyModuleNames); unconfigured tools drop out. */
function navigationEntries(
  items: NavDefinition[],
  labels: Labels,
  external: Record<string, string | undefined>,
): NavEntry[] {
  return items.flatMap((item) => {
    // A group is a disclosure, not a link.
    const href = item.children
      ? ""
      : item.external
        ? external[item.id]
        : (item.href ?? `/modules/${item.id}`);
    if (href === undefined) return [];
    return [
      {
        id: item.id,
        label: label(labels, "dashboard", "module-name", item.id, item.name),
        icon: item.icon,
        href,
        external: item.external === true,
        ...(item.children
          ? {
              children: navigationEntries(item.children, labels, external),
            }
          : {}),
      },
    ];
  });
}
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
        accessibility={Object.fromEntries(
          Object.entries(config.accessibility || {}).map(([k, v]) => [
            k,
            Number(v.value) || 0,
          ]),
        )}
        organization={user.organization}
        navigation={
          <Navigation
            items={navigationEntries(
              visibleNavigation(user.modules),
              labels,
              externalToolUrls(),
            )}
          />
        }
      >
        {children}
      </AppShell>
      <ChatbotMount />
    </div>
  );
}
