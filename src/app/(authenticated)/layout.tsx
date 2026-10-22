import { pageIdentity } from "@/server/auth/page";
import { dashboardConfiguration } from "@/server/configuration/service";
import {
  resources,
  label,
  resourceDescription,
} from "@/server/configuration/resources";
import { displayFormat } from "@/server/configuration/formatting";
import { availableThemes } from "@/server/account/themes";
import { AppShell } from "@/components/layout/app-shell";
import { Navigation } from "@/components/layout/navigation";
import { visibleNavigation } from "@/server/permissions/policy";
import type { NavDefinition, NavEntry } from "@/lib/unavailable-modules";
import {
  findTheme,
  presetThemes,
  themeVariables,
} from "@/features/account/themes";
import {
  shellLabelKeys,
  type ShellLabels,
} from "@/features/account/shell-labels";
import { externalToolUrls } from "./modules/external-tools";
import { ChatbotMount } from "@/components/chatbot/chatbot-mount";
import { cachedRead } from "@/server/cache/reads";
import { TTL } from "@/server/cache/memo";
type Labels = Awaited<ReturnType<typeof resources>>;
// GN-Angular marks the Opportunities group and the finder when getOpportunitiesNewFlags reports anything new.
const flagged = new Set(["opportunities-group", "opportunities-finder"]);
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
        ...(flagged.has(item.id) ? { isNew: true } : {}),
        ...(item.children
          ? {
              children: navigationEntries(item.children, labels, external),
            }
          : {}),
      },
    ];
  });
}
function shellLabels(rows: Labels): ShellLabels {
  return {
    ...(Object.fromEntries(
      Object.entries(shellLabelKeys).map(([name, [group, key, fallback]]) => [
        name,
        label(rows, "dashboard", group, key, fallback),
      ]),
    ) as Record<keyof typeof shellLabelKeys, string>),
    themeHelp: resourceDescription(rows, "dashboard", "header-labels", "theme"),
    infoletsHelp: resourceDescription(
      rows,
      "dashboard",
      "header-labels",
      "infolets",
    ),
  };
}
/** Whether any opportunity is new for this user; the dot is decoration, so a failure shows none (as GN-Angular). */
async function opportunitiesNew(token: string) {
  try {
    const flags = (await cachedRead(
      "getSharedGetOpportunitiesNewFlags",
      { token },
      TTL.access,
    )) as Record<string, unknown>;
    return flags.is_new_preference === "Y" || flags.is_new_others === "Y";
  } catch {
    return false;
  }
}
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session } = await pageIdentity("/home");
  const items = visibleNavigation(user.modules);
  // The new-opportunities dot streams in; it starts with the shell's reads, never fails, and is awaited by Navigation.
  const isNew = items.some((i) => i.id === "opportunities-group")
    ? opportunitiesNew(session.token)
    : Promise.resolve(false);
  const preferences = dashboardConfiguration();
  const [config, labels, format, themes] = await Promise.all([
    preferences,
    resources(),
    displayFormat(),
    // Only an organisation theme needs getCustomTheme; the presets are known.
    preferences.then((c) =>
      c.theme?.startsWith("apitheme:") ? availableThemes() : presetThemes,
    ),
  ]);
  const theme = findTheme(themes, config.theme);
  return (
    <div
      id="app"
      className={theme.dark ? "app dark" : "app"}
      style={themeVariables(theme) as React.CSSProperties}
    >
      {session.fixture && (
        <div id="fixture-banner" className="fixture-banner">
          DEVELOPMENT FIXTURES — synthetic identity and data; no live Oracle
          connection
        </div>
      )}
      {session.source === "browser-session" && (
        <div id="browser-session-banner" className="fixture-banner">
          LOCAL DEV — live Oracle DEV data via captured browser session
        </div>
      )}
      <AppShell
        name={user.name}
        labels={shellLabels(labels)}
        format={format && { dateFormat: format.dateFormat }}
        accessibility={Object.fromEntries(
          Object.entries(config.accessibility || {}).map(([k, v]) => [
            k,
            Number(v.value) || 0,
          ]),
        )}
        navigation={
          <Navigation
            items={navigationEntries(items, labels, externalToolUrls())}
            isNew={isNew}
          />
        }
      >
        {children}
      </AppShell>
      <ChatbotMount />
    </div>
  );
}
