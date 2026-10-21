import "server-only";
import { organizations } from "@/server/configuration/service";
import { dateDisplay } from "@/lib/format";
import { widgets } from "@/server/home/widgets";
import { authenticate } from "@/server/session/service";
import { oracle, assertBusiness } from "@/server/api/transport";
import { resources, label } from "@/server/configuration/resources";
import {
  fixtureMode,
  oracleSettings,
} from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import {
  accessibilityKeys,
  dashboardChange,
  researchSchema,
  personStatusSchema,
  type AccountData,
} from "@/features/account/contracts";
const visible = (rows: Awaited<ReturnType<typeof resources>>, key: string) =>
  rows.some(
    (r) =>
      r.module_name.toLowerCase() === "dashboard" &&
      r.label_type === "labels" &&
      r.label_name === key &&
      r.is_visible === "Y",
  );
export async function accountData(panel = "profile"): Promise<AccountData> {
  const { session, user } = await authenticate();
  const [raw, identity, rows] = await Promise.all([
    oracle("getSharedDashboardPreferences", { token: session.token }),
    panel === "profile"
      ? oracle("getSessionValidate", { token: session.token })
      : Promise.resolve({}),
    resources(),
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
        label: label(rows, "dashboard", "labels", key, fallback),
        value: key === "dob" ? dateDisplay(value) : value,
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
            label: label(rows, "dashboard", "labels", key, fallback),
            value:
              role.role_name +
              (typeof role.org_name === "string" ? ` (${role.org_name})` : ""),
          });
  const maps = (group: string) =>
    Object.fromEntries(
      Object.entries(
        (config[group] || {}) as Record<string, { isVisible?: boolean }>,
      ).map(([k, v]) => [k, v.isVisible === true]),
    );
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
  if (researchAllowed && panel === "profile") {
    const body = assertBusiness(
      await oracle("getSharedUserPreference", { token: session.token }),
    );
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
    for (const [key, lov] of [
      ["research_areas", "AREAS_OF_INTEREST"],
      ["research_keywords", "RESEARCH_KEYWORDS"],
    ]) {
      const b = assertBusiness(
        await oracle("getSharedUserPreferenceLOV", {
          token: session.token,
          lov_type: lov,
        }),
      );
      options[key] = ((b.items || []) as Record<string, unknown>[]).flatMap(
        (i) => (typeof i.label === "string" ? [i.label] : []),
      );
    }
    const funders = assertBusiness(
      await oracle("getSharedGetOppFunders", { token: session.token }),
    );
    options.favourite_funder = (
      (funders.items || []) as Record<string, unknown>[]
    ).flatMap((i) => (typeof i.value === "string" ? [i.value] : []));
  }
  const manageAllowed = visible(rows, "manage");
  let status: AccountData["status"] = {
    status_code: "ACTIVE",
    effective_start_date: "",
    effective_end_date: "",
    status_msg: "",
    proxy_users: [],
  };
  let orgs: AccountData["organizations"] = [];
  if (manageAllowed && panel === "profile") {
    const raw = assertBusiness(
      await oracle("getSharedPersonStatus", { token: session.token }),
    );
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
    orgs = await organizations();
  }
  return {
    fields,
    manageAllowed,
    status,
    organizations: orgs,
    research,
    researchAllowed,
    options,
    labels: Object.fromEntries(widgets.map((w) => [w.id, w.title])),
    settings: {
      theme: typeof config.theme === "string" ? config.theme : "theme-default",
      accessibility,
      needAttention: maps("needAttention"),
      insights: maps("insights"),
      ...(typeof config.opportunity === "boolean"
        ? { opportunity: config.opportunity }
        : {}),
      ...(typeof config.notifications === "boolean"
        ? { notifications: config.notifications }
        : {}),
    },
  };
}
async function write(path: string, token: string, body: unknown) {
  if (fixtureMode()) {
    const { fixtureSettings } = await import("@/test-support/account-store");
    fixtureSettings(path, body as Record<string, unknown>);
    return;
  }
  const config = oracleSettings();
  let response: Response;
  try {
    response = await fetch(new URL(path, config.apps), {
      method: "POST",
      headers: {
        token,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.authorization
          ? { Authorization: config.authorization }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      "UPSTREAM",
      "Settings could not be saved. Please retry.",
    );
  }
  if (response.status === 401)
    throw new AppError("EXPIRED", "Your session has expired.", 401);
  if (response.status === 403)
    throw new AppError("FORBIDDEN", "This settings change was denied.", 403);
  if (!response.ok)
    throw new AppError(
      "UPSTREAM",
      "Settings could not be saved. Please retry.",
    );
  const text = await response.text();
  if (text.trim()) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AppError("CONTRACT", "Invalid settings response.");
    }
    assertBusiness(parsed);
    if (parsed && typeof parsed === "object" && parsed.error)
      throw new AppError("BUSINESS", "Oracle could not save these settings.");
  }
}
export async function saveAccount(kind: string, body: unknown) {
  const { session, user } = await authenticate();
  if (kind === "status") {
    const rows = await resources();
    if (!visible(rows, "manage"))
      throw new AppError("FORBIDDEN", "Status management is unavailable.", 403);
    const input = personStatusSchema.parse(body);
    const own = assertBusiness(
      await oracle("getSharedPersonStatus", { token: session.token }),
    );
    const allowed = input.status_code === "OOO" ? await organizations() : [];
    const proxies: Record<string, unknown>[] = [];
    for (const proxy of input.status_code === "OOO" ? input.proxy_users : []) {
      if (
        !allowed.some((o) => o.id === proxy.org_id) ||
        proxy.proxy_pid === user.personId
      )
        throw new AppError("FORBIDDEN", "Invalid proxy selection.", 403);
      const people = await proxyPeople(proxy.org_id);
      if (!people.some((p) => p.id === proxy.proxy_pid))
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
    await write("shared/PersonStatus", session.token, {
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
    await write(
      "shared/UserPreference",
      session.token,
      Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, [...new Set(v)].join(",")]),
      ),
    );
    return;
  }
  if (kind !== "dashboard")
    throw new AppError("BAD_REQUEST", "Unknown settings change.", 400);
  const input = dashboardChange.parse(body);
  const current = assertBusiness(
    await oracle("getSharedDashboardPreferences", { token: session.token }),
  );
  for (const group of ["needAttention", "insights"] as const)
    if (input[group])
      for (const key of Object.keys(input[group]!))
        if (!Object.hasOwn((current[group] || {}) as object, key))
          throw new AppError("FORBIDDEN", "Unknown dashboard preference.", 403);
  for (const key of ["opportunity", "notifications"] as const)
    if (input[key] !== undefined && !Object.hasOwn(current, key))
      throw new AppError("FORBIDDEN", "Unknown dashboard preference.", 403);
  // Preserve server-owned metadata and all settings not edited in this form.
  const merged: Record<string, unknown> = { ...current, ...input };
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
  await write("shared/dashboardPreferences", session.token, merged);
}

export async function proxyPeople(orgId: string) {
  const { session, user } = await authenticate();
  const rows = await resources();
  if (
    !visible(rows, "manage") ||
    !(await organizations()).some((o) => o.id === orgId)
  )
    throw new AppError("FORBIDDEN", "Organization unavailable.", 403);
  const raw = assertBusiness(
    await oracle("getPre_awardGetPersonList", {
      token: session.token,
      p_org_id: orgId,
    }),
  );
  return (Array.isArray(raw.items) ? raw.items : []).flatMap(
    (p: Record<string, unknown>) => {
      const id = p.person_id ?? p.PERSON_ID,
        name = p.full_name ?? p.FULL_NAME;
      return typeof name === "string" &&
        id != null &&
        String(id) !== user.personId
        ? [{ id: String(id), name }]
        : [];
    },
  );
}
