import "server-only";
import type { z } from "zod";
import {
  forgetDashboardConfiguration,
  organizations,
} from "@/server/platform/configuration/service";
import { displayFormat } from "@/server/platform/configuration/formatting";
import {
  infoletSettings,
  infoletSwitches,
} from "@/features/modules/account/infolets";
import {
  authenticate,
  validatedIdentity,
} from "@/server/identity/session/service";
import { forgetOperation } from "@/server/oracle/cache";
import { assertBusiness } from "@/server/oracle/connection";
import {
  account,
  configuration,
  opportunities,
  people,
} from "@/server/oracle/api";
import { availableThemes } from "./themes";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { fixtureMode } from "@/server/platform/configuration/environment";
import { AppError } from "@/lib/errors";
import {
  accessibilityKeys,
  dashboardChange,
  researchSchema,
  personStatusSchema,
  presenceKeys,
  presenceSchema,
  type AccountData,
  type DigitalPresence,
} from "@/features/modules/account/contracts";
import { serverConstants } from "@/server/constants";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
const visible = (rows: Resources, key: string) =>
  serverFunctions.resources.resourceVisible(rows, "dashboard", "labels", key);
/** The funder names offered as favourite funders. */
const funderNames = (body: unknown) =>
  (
    ((body as { items?: unknown }).items || []) as Record<string, unknown>[]
  ).flatMap((i) => (typeof i.value === "string" ? [i.value] : []));
export async function accountData(panel = "profile"): Promise<AccountData> {
  const { session, user } = await authenticate();
  const themes = serverFunctions.async.early(
    panel === "preferences" ? availableThemes() : Promise.resolve([]),
  );
  // Preferences are read fresh here: this panel edits them.
  const [raw, identity, rows, format] = await Promise.all([
    configuration.storedPreferences(),
    // The validation authenticate() already shares for this token.
    panel === "profile"
      ? validatedIdentity(session.token)
      : Promise.resolve({}),
    resources(),
    displayFormat(),
  ]);
  const config = assertBusiness(raw),
    person = assertBusiness(identity);
  const fields: { label: string; value: string }[] = [];
  for (const [key, value, fallback] of [
    ["full-name", user.name, "Full name"],
    ["org-unit", user.organization, "Org Unit"],
    ["position", person.position, "Position"],
    ["gender", person.gender, "Gender"],
    ["dob", person.date_of_birth, "Date of birth"],
  ] as const)
    if (typeof value === "string" && value && visible(rows, key))
      fields.push({
        label: serverFunctions.resources.label(
          rows,
          "dashboard",
          "labels",
          key,
          fallback,
        ),
        value:
          key === "dob" ? functions.format.dateDisplay(value, format) : value,
      });
  for (const [key, source, fallback] of [
    ["institutional-roles", "institutional_roles", "Institutional roles"],
    ["approver-roles", "approver_roles", "Approver roles"],
    ["system-roles", "project_roles", "System roles"],
  ] as const)
    if (visible(rows, key) && Array.isArray(person[source]))
      for (const role of person[source] as Record<string, unknown>[])
        if (typeof role.role_name === "string")
          fields.push({
            label: serverFunctions.resources.label(
              rows,
              "dashboard",
              "labels",
              key,
              fallback,
            ),
            value:
              role.role_name +
              (typeof role.org_name === "string" ? ` (${role.org_name})` : ""),
          });
  const accessibility = Object.fromEntries(
    accessibilityKeys.map((key) => [
      key,
      Number(
        (
          config.accessibility as Record<string, { value?: number }> | undefined
        )?.[key]?.value,
      ) || 0,
    ]),
  );
  const researchAllowed =
    visible(rows, "preference") &&
    user.modules["opportunities-finder"] === true;
  let research = {
    research_areas: [] as string[],
    favourite_funder: [] as string[],
    research_keywords: [] as string[],
  };
  const options: Record<string, string[]> = {};
  const manageAllowed = visible(rows, "manage");
  // The research and status reads are independent; both start before either is used.
  const statusRead =
    manageAllowed && panel === "profile"
      ? serverFunctions.async.early(
          Promise.all([account.personStatus(), organizations()]),
        )
      : undefined;
  if (researchAllowed && panel === "profile") {
    const [preference, areas, keywords, funders] = await Promise.all([
      // Shared with the finder (VBCS app-level userPreferences); a research save drops it.
      opportunities.userPreference(),
      account.preferenceOptions({ lov: "AREAS_OF_INTEREST" }),
      account.preferenceOptions({ lov: "RESEARCH_KEYWORDS" }),
      opportunities.funders().then(funderNames),
    ]);
    const body = assertBusiness(preference);
    const item =
      (body.items as Record<string, unknown>[] | undefined)?.[0] || {};
    research = Object.fromEntries(
      Object.keys(research).map((k) => [
        k,
        typeof item[k] === "string"
          ? (item[k] as string).split(",").filter(Boolean)
          : [],
      ]),
    ) as typeof research;
    options.research_areas = areas;
    options.research_keywords = keywords;
    options.favourite_funder = funders;
  }
  let status: AccountData["status"] = {
    status_code: "ACTIVE",
    effective_start_date: "",
    effective_end_date: "",
    status_msg: "",
    proxy_users: [],
  };
  let orgs: AccountData["organizations"] = [];
  if (statusRead) {
    const [own, allowed] = await statusRead;
    const raw = assertBusiness(own);
    status = {
      status_code: raw.status_code === "OOO" ? "OOO" : "ACTIVE",
      effective_start_date:
        typeof raw.effective_start_date === "string"
          ? raw.effective_start_date
          : "",
      effective_end_date:
        typeof raw.effective_end_date === "string"
          ? raw.effective_end_date
          : "",
      status_msg: typeof raw.status_msg === "string" ? raw.status_msg : "",
      proxy_users: Array.isArray(raw.proxy_users)
        ? raw.proxy_users.map((p: Record<string, unknown>) => ({
            org_id: String(p.org_id),
            proxy_pid: String(p.proxy_pid),
          }))
        : [],
    };
    orgs = allowed;
  }
  return {
    fields,
    manageAllowed,
    status,
    organizations: orgs,
    research,
    researchAllowed,
    options,
    // Switch labels from RB, as legacy's drawer (not the widget titles).
    labels: Object.fromEntries(
      Object.values(infoletSwitches)
        .flat()
        .map(([key, group, name, seed]) => [
          key,
          serverFunctions.resources.label(rows, "dashboard", group, name, seed),
        ]),
    ),
    themes: await themes,
    presenceAllowed: visible(rows, "digital-presence"),
    settings: {
      theme: typeof config.theme === "string" ? config.theme : "theme-default",
      accessibility,
      needAttention: infoletSettings(
        "needAttention",
        config.needAttention as Parameters<typeof infoletSettings>[1],
      ),
      insights: infoletSettings(
        "insights",
        config.insights as Parameters<typeof infoletSettings>[1],
      ),
      ...(typeof config.opportunity === "boolean"
        ? { opportunity: config.opportunity }
        : {}),
      ...(typeof config.notifications === "boolean"
        ? { notifications: config.notifications }
        : {}),
    },
  };
}
const SETTINGS = {
  "shared/PersonStatus": account.savePersonStatus,
  "shared/UserPreference": account.saveUserPreference,
  "shared/dashboardPreferences": account.saveDashboardPreferences,
} as const;
/** The client's failures in this screen's words; a business error keeps the backend's own text. */
function settingsError(e: unknown) {
  if (!(e instanceof AppError)) return e;
  if (e.code === "UPSTREAM")
    return new AppError(
      "UPSTREAM",
      "Settings could not be saved. Please retry.",
    );
  if (e.code === "FORBIDDEN")
    return new AppError("FORBIDDEN", "This settings change was denied.", 403);
  if (e.code === "CONTRACT")
    return new AppError("CONTRACT", "Invalid settings response.");
  return e;
}
async function write(path: keyof typeof SETTINGS, body: unknown) {
  if (fixtureMode()) {
    const { fixtureSettings } = await import("@/test-support/account-store");
    fixtureSettings(path, body as Record<string, unknown>);
    return;
  }
  let reply: unknown;
  try {
    // Settings saves give up after 15 s, as before; the client's own limit is longer.
    reply = await SETTINGS[path](
      { body },
      { signal: AbortSignal.timeout(serverConstants.timeouts.save) },
    );
  } catch (e) {
    throw settingsError(e);
  }
  if (
    reply &&
    typeof reply === "object" &&
    (reply as { error?: unknown }).error
  )
    throw new AppError("BUSINESS", "Oracle could not save these settings.");
}
/** The five profile links (legacy getSharedDigitalPresence2, `pid` from the session); RB-gated, fail closed. */
export async function digitalPresence(): Promise<DigitalPresence> {
  const { user } = await authenticate();
  if (!visible(await resources(), "digital-presence"))
    throw new AppError("FORBIDDEN", "Digital presence is unavailable.", 403);
  const body = assertBusiness(
    await account.digitalPresence({ personId: user.personId }),
  );
  const item = (
    Array.isArray(body.items) ? (body.items[0] ?? {}) : {}
  ) as Record<string, unknown>;
  return Object.fromEntries(
    presenceKeys.map((k) => [k, typeof item[k] === "string" ? item[k] : ""]),
  ) as DigitalPresence;
}
export async function saveAccount(kind: string, body: unknown) {
  const { session, user } = await authenticate();
  if (kind === "presence") {
    if (!visible(await resources(), "digital-presence"))
      throw new AppError("FORBIDDEN", "Digital presence is unavailable.", 403);
    // The legacy contract carries the token in the query string; it goes as a header here (no tokens in URLs).
    await account.saveDigitalPresence(presenceSchema.parse(body));
    return;
  }
  if (kind === "status") {
    const rows = await resources();
    if (!visible(rows, "manage"))
      throw new AppError("FORBIDDEN", "Status management is unavailable.", 403);
    const input = personStatusSchema.parse(body);
    const chosen = input.status_code === "OOO" ? input.proxy_users : [];
    const [rawOwn, allowed] = await Promise.all([
      account.storedPersonStatus(),
      input.status_code === "OOO" ? organizations() : [],
    ]);
    const own = assertBusiness(rawOwn);
    // Each allowed org's directory is read at once; every proxy is still checked in order before the write.
    const directories = chosen.map((proxy) =>
      allowed.some((o) => o.id === proxy.org_id)
        ? serverFunctions.async.early(proxyPeople(proxy.org_id))
        : undefined,
    );
    const proxies: Record<string, unknown>[] = [];
    for (const [i, proxy] of chosen.entries()) {
      const directory = directories[i];
      if (!directory || proxy.proxy_pid === user.personId)
        throw new AppError("FORBIDDEN", "Invalid proxy selection.", 403);
      const members = await directory;
      if (!members.some((p) => p.id === proxy.proxy_pid))
        throw new AppError(
          "FORBIDDEN",
          "Proxy is not in the authorized directory.",
          403,
        );
      const existing = Array.isArray(own.proxy_users)
        ? own.proxy_users.find(
            (p: Record<string, unknown>) =>
              String(p.org_id) === proxy.org_id &&
              String(p.proxy_pid) === proxy.proxy_pid,
          )
        : undefined;
      proxies.push({ ...proxy, ...(existing?.id ? { id: existing.id } : {}) });
    }
    // A failed save may still have landed, so the held status is dropped either way.
    try {
      await write("shared/PersonStatus", {
        ...(own.id ? { id: own.id } : {}),
        pid: user.personId,
        status_code: input.status_code,
        effective_start_date:
          input.status_code === "OOO" ? input.effective_start_date : "",
        effective_end_date:
          input.status_code === "OOO" ? input.effective_end_date : "",
        status_msg: input.status_code === "OOO" ? input.status_msg : "",
        proxy_users: input.status_code === "OOO" ? proxies : [],
      });
    } finally {
      forgetOperation("getSharedPersonStatus", session.token);
    }
    return;
  }
  if (kind === "research") {
    const rows = await resources();
    if (
      !visible(rows, "preference") ||
      user.modules["opportunities-finder"] !== true
    )
      throw new AppError(
        "FORBIDDEN",
        "Research preferences are unavailable.",
        403,
      );
    const input = researchSchema.parse(body);
    // The profile and the finder's preference tab both read it; dropped even if the save fails part-way.
    try {
      await write(
        "shared/UserPreference",
        Object.fromEntries(
          Object.entries(input).map(([k, v]) => [k, [...new Set(v)].join(",")]),
        ),
      );
    } finally {
      forgetOperation("getSharedUserPreference", session.token);
      // Featured and its new-flags dot are filtered by these preferences in Oracle.
      forgetOperation("getSharedGetOpportunities", session.token);
      forgetOperation("getSharedGetOpportunitiesNewFlags", session.token);
    }
    return;
  }
  if (kind !== "dashboard")
    throw new AppError("BAD_REQUEST", "Unknown settings change.", 400);
  const input = dashboardChange.parse(body);
  // Read fresh (never the memo): the write merges over exactly what Oracle holds now.
  const stored = serverFunctions.async.early(configuration.storedPreferences());
  if (
    input.theme !== undefined &&
    !(await availableThemes()).some((t) => t.id === input.theme)
  )
    throw new AppError("FORBIDDEN", "Unknown theme.", 403);
  const current = assertBusiness(await stored);
  for (const group of ["needAttention", "insights"] as const)
    if (input[group])
      for (const key of Object.keys(input[group]!))
        if (!Object.hasOwn((current[group] || {}) as object, key))
          throw new AppError("FORBIDDEN", "Unknown dashboard preference.", 403);
  for (const key of ["opportunity", "notifications"] as const)
    if (input[key] !== undefined && !Object.hasOwn(current, key))
      throw new AppError("FORBIDDEN", "Unknown dashboard preference.", 403);
  try {
    await write(
      "shared/dashboardPreferences",
      dashboardPayload(current, input),
    );
  } finally {
    // Even a failed save may have landed; the shell and Home read Oracle again.
    forgetDashboardConfiguration(session.token);
  }
}
/**
 * H1: the contracted keys only (VBCS type getSharedDashboardPreferences). Unedited settings, including the
 * two section switches the drawer edits and the old transformPayload posts, keep their stored values.
 */
export function dashboardPayload(
  current: Record<string, unknown>,
  input: z.infer<typeof dashboardChange>,
) {
  // Undefined values drop out of the JSON body, as absent keys.
  const merged: Record<string, unknown> = {
    theme: input.theme ?? current.theme,
    opportunity: input.opportunity ?? current.opportunity,
    notifications: input.notifications ?? current.notifications,
    needAttentionSwitch: current.needAttentionSwitch,
    insightsSwitch: current.insightsSwitch,
  };
  for (const group of ["needAttention", "insights"] as const)
    merged[group] = {
      ...Object.fromEntries(
        Object.entries(
          (current[group] || {}) as Record<string, { isVisible?: boolean }>,
        ).map(([k, v]) => [k, v.isVisible === true]),
      ),
      ...input[group],
    };
  merged.accessibility = Object.fromEntries(
    accessibilityKeys.map((k) => [
      k,
      input.accessibility
        ? String(input.accessibility[k])
        : String(
            (
              current.accessibility as
                Record<string, { value?: number }> | undefined
            )?.[k]?.value || 0,
          ),
    ]),
  );
  return merged;
}

export async function proxyPeople(orgId: string) {
  const [{ user }, rows, orgs] = await Promise.all([
    authenticate(),
    resources(),
    organizations(),
  ]);
  if (!visible(rows, "manage") || !orgs.some((o) => o.id === orgId))
    throw new AppError("FORBIDDEN", "Organization unavailable.", 403);
  // An org's directory is reference data; the proxy picker and the status save share it.
  const body = (await people.inOrg({ orgId })) as { items?: unknown };
  const directory = Array.isArray(body.items)
    ? (body.items as Record<string, unknown>[])
    : [];
  return directory.flatMap((p) => {
    const id = p.person_id ?? p.PERSON_ID,
      name = p.full_name ?? p.FULL_NAME;
    return typeof name === "string" &&
      id != null &&
      String(id) !== user.personId
      ? [{ id: String(id), name }]
      : [];
  });
}
