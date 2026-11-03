import { pageIdentity } from "@/server/identity/auth/page";
import { dashboardConfiguration } from "@/server/platform/configuration/service";
import { resources } from "@/server/platform/configuration/resources";
import {
  displayFormat,
  globalVariables,
} from "@/server/platform/configuration/formatting";
import { availableThemes } from "@/server/modules/account/themes";
import { AppShell } from "@/components/layout/app-shell";
import { Navigation } from "@/components/layout/navigation";
import type { NavDefinition, NavEntry } from "@/lib/unavailable-modules";
import {
  findTheme,
  presetThemes,
  themeVariables,
} from "@/features/modules/account/themes";
import {
  shellLabelKeys,
  type ShellLabels,
} from "@/features/modules/account/shell-labels";
import { externalToolUrls } from "./modules/external-tools";
import { ChatbotMount } from "@/components/chatbot/chatbot-mount";
import { GuideMount } from "@/features/guides/guide-mount";
import { opportunities } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
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
        label: serverFunctions.resources.label(
          labels,
          "dashboard",
          "module-name",
          item.id,
          item.name,
        ),
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
/** Granted navigation ids only; guides use them to stay within the user's access. */
const grantedIds = (items: NavDefinition[]): string[] =>
  items.flatMap((i) => [i.id, ...grantedIds(i.children ?? [])]);
function shellLabels(rows: Labels): ShellLabels {
  return {
    ...(Object.fromEntries(
      Object.entries(shellLabelKeys).map(([name, [group, key, fallback]]) => [
        name,
        serverFunctions.resources.label(
          rows,
          "dashboard",
          group,
          key,
          fallback,
        ),
      ]),
    ) as Record<keyof typeof shellLabelKeys, string>),
    themeHelp: serverFunctions.resources.resourceDescription(
      rows,
      "dashboard",
      "header-labels",
      "theme",
    ),
    infoletsHelp: serverFunctions.resources.resourceDescription(
      rows,
      "dashboard",
      "header-labels",
      "infolets",
    ),
  };
}
/** Whether any opportunity is new for this user; the dot is decoration, so a failure shows none (as GN-Angular). */
async function opportunitiesNew() {
  try {
    const flags = (await opportunities.newFlags()) as Record<string, unknown>;
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
  const items = serverFunctions.permissions.visibleNavigation(user.modules);
  // The new-opportunities dot streams in; it starts with the shell's reads, never fails, and is awaited by Navigation.
  const isNew = items.some((i) => i.id === "opportunities-group")
    ? opportunitiesNew()
    : Promise.resolve(false);
  // The shell only takes the theme and accessibility from these, so a failed read shows the defaults, not an error page.
  const preferences = dashboardConfiguration().catch(
    (e): Awaited<ReturnType<typeof dashboardConfiguration>> => {
      if (e instanceof AppError && e.status === 401) throw e;
      return { needAttention: {}, insights: {} };
    },
  );
  const [config, labels, format, logo, themes] = await Promise.all([
    preferences,
    resources(),
    displayFormat(),
    // Legacy header: the configured APPLICATION_LOGO_URL, else the GrantsNow logo; the logo is decoration, so a failure shows ours.
    globalVariables().then(
      (items) =>
        functions.security.safeImageUrl(
          items.find((v) => v.var_key === "APPLICATION_LOGO_URL")?.var_value,
        ),
      () => undefined,
    ),
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
        user={{
          name: user.name,
          organization: user.organization,
          organizationId: user.organizationId,
          modules: user.modules,
        }}
        logo={logo}
        labels={shellLabels(labels)}
        format={format && { dateFormat: format.dateFormat }}
        accessibility={Object.fromEntries(
          Object.entries(config.accessibility || {}).map(([k, v]) => [
            k,
            Number(v.value) || 0,
          ]),
        )}
        guide={<GuideMount access={grantedIds(items)} />}
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
