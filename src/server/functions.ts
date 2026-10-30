import "server-only";
/**
 * App-wide pure server helpers, by category (owner, 2026-10-29): read them by path
 * (`serverFunctions.permissions.requireModule`). Helpers the browser also uses are in `@/lib/functions`; services that
 * read Oracle stay in their modules.
 */
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { z } from "zod";
import {
  type Choice,
  type ChoiceList,
} from "@/server/platform/configuration/choices";
import { AppError } from "@/lib/errors";
import merge from "lodash/merge";
import mapValues from "lodash/mapValues";
import {
  type Column,
  type FilterLabels,
} from "@/features/modules/proposals/types";
import sourceDefaults from "@/server/platform/configuration/resource-defaults.json";
import { type Resources } from "@/server/platform/configuration/resources";
import { type UserContext } from "@/shared/auth/types";
import {
  navigationDefinitions,
  type NavDefinition,
} from "@/lib/unavailable-modules";
import {
  type ObjectAccess,
  type ObjectRoleRow,
  type PageAccess,
  type RoleRow,
} from "@/server/platform/permissions";

/**
 * Marks a promise started early and awaited later: a rejection before that await (e.g. an earlier check threw)
 * must not surface as an unhandled rejection. Awaiting the returned promise still throws its error.
 */
function early<T>(promise: Promise<T>) {
  promise.catch(() => {});
  return promise;
}

/** Runs `tasks` with at most `limit` in flight; results keep the input order and the first failure rejects. */
async function bounded<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        // The result is lost anyway; start no more tasks.
        next = tasks.length;
        throw e;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
}

/**
 * Backend HTML (announcements, notifications, opportunity summaries, chatbot answers) through DOMPurify,
 * as legacy `renderAsHTML` does (D15): inline styles, tables and CKEditor classes survive.
 * Hardened beyond legacy: no <style>/form controls, no positioning or url() in style attributes,
 * links open in a new tab, and only http(s), mailto and same-origin relative URLs.
 */
const purify = DOMPurify(new JSDOM("").window);

// Declarations that let authored HTML escape its box or fetch assets.
const unsafeStyle =
  /^(?:position|z-index|inset|top|right|bottom|left|behavior|-moz-binding)$|url\(|expression\(|javascript:/i;
purify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  data.attrValue = data.attrValue
    .split(";")
    .map((d) => d.trim())
    .filter((d) => {
      const [property = "", ...value] = d.split(":");
      return (
        d !== "" &&
        value.length > 0 &&
        !unsafeStyle.test(property.trim()) &&
        !unsafeStyle.test(value.join(":"))
      );
    })
    .join("; ");
  if (data.attrValue === "") data.keepAttr = false;
});
purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/** Backend rich text as plain text (legacy `stripMarkup`): tags dropped, entities decoded. */
function plainText(html: string) {
  if (!html.includes("<") && !html.includes("&")) return html;
  return (
    purify
      .sanitize(html, { ALLOWED_TAGS: [], RETURN_DOM: true })
      .textContent?.trim() ?? ""
  );
}

function sanitizeHtml(html: string) {
  return purify.sanitize(html.replace(/\\r\\n/g, ""), {
    FORBID_TAGS: ["style", "form", "input", "button", "select", "textarea"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/(?![/\\])|\?)/i,
  });
}

const items = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});

const str = (v: unknown) =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

/** One lookup type's codes with "All" (code '') first, as legacy loadLookups adds it for status lists. */
function statusChoices(raw: unknown, type: string): Choice[] {
  const rows = items
    .parse(raw)
    .items.filter(
      (r) =>
        (r.lookup_type_code ?? type) === type &&
        typeof r.lookup_code === "string" &&
        /^[A-Z0-9_]{1,40}$/.test(r.lookup_code),
    );
  return [
    { value: "", label: "All" },
    ...rows.map((r) => ({
      value: r.lookup_code as string,
      label:
        str(r.lookup_code_descr) ??
        str(r.lookup_code_value) ??
        (r.lookup_code as string),
    })),
  ];
}

const sortColumn = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;

/** getObjectDates: the date columns a listing can sort by; an unsafe column name is dropped. */
function objectDateChoices(raw: unknown): Choice[] {
  return items.parse(raw).items.flatMap((r) => {
    const value = str(r.column_name);
    return value && sortColumn.test(value)
      ? [{ value, label: str(r.column_description) ?? value }]
      : [];
  });
}

/** Distinct non-empty values of one field, in their order, each its own label (funder and party names). */
function nameChoices(raw: unknown, field: string): Choice[] {
  const values = items.parse(raw).items.flatMap((r) => str(r[field]) ?? []);
  return [...new Set(values)].map((value) => ({ value, label: value }));
}

async function choiceList<T>(
  read: () => T[] | Promise<T[]>,
  failure: string,
): Promise<ChoiceList<T>> {
  try {
    return { options: await read(), errors: [] };
  } catch {
    return { options: [], errors: [failure] };
  }
}

const resource = z.object({
  module_name: z.string(),
  label_type: z.string(),
  label_name: z.string(),
  label_value: z.string().nullish(),
  label_description: z.string().nullish(),
  is_visible: z.enum(["Y", "N"]).nullish(),
  // A row with no flag (neither the backend nor the seed sets one) means "use the field's default" (resourceRequired).
  is_mandatory: z.string().nullish(),
  preferences: z.unknown().optional(),
});

type Row = z.infer<typeof resource>;

/**
 * Legacy mergeTranslations: `_.merge(strings, backendRows)`, the backend's rows laid over the design-time seed (legacy
 * strings.js) field by field. As legacy's restructuringTranslation, an empty description counts as absent and missing
 * preferences as `{}`; lodash then keeps the seed's value wherever the backend's is undefined.
 */
const overRow = (seed: Row | undefined, row: Row): Row =>
  merge({}, seed, {
    ...row,
    label_description:
      row.label_description === "" ? undefined : row.label_description,
    preferences: row.preferences ?? {},
  });

function mergeResourceDefaults(raw: unknown) {
  const overrides = z.array(resource).parse(raw);
  const key = (r: Row) =>
    `${r.module_name.toLowerCase()}:${r.label_type}:${r.label_name}`;
  const merged = new Map(
    z
      .array(resource)
      .parse(sourceDefaults)
      .map((r) => [key(r), r]),
  );
  for (const row of overrides)
    merged.set(key(row), overRow(merged.get(key(row)), row));
  return [...merged.values()];
}

function label(
  rows: Resources,
  module: string,
  group: string,
  key: string,
  fallback: string,
) {
  return (
    rows.find(
      (r) =>
        r.module_name.toLowerCase() === module.toLowerCase() &&
        r.label_type === group &&
        r.label_name === key,
    )?.label_value || fallback
  );
}

/** An entry's More Info text (`label_description`), sanitised for the HelpButton; null when there is none. */
function resourceDescription(
  rows: Resources,
  module: string,
  group: string,
  key: string,
) {
  const text = rows.find(
    (r) =>
      r.module_name.toLowerCase() === module.toLowerCase() &&
      r.label_type === group &&
      r.label_name === key,
  )?.label_description;
  return text === null || text === undefined || text.trim() === ""
    ? null
    : sanitizeHtml(text);
}

/** The one resource-visibility rule: shown only on an explicit 'Y'; a missing bundle, key or flag hides it. */
function resourceVisible(
  rows: Resources,
  module: string,
  group: string,
  key: string,
) {
  return rows.some(
    (r) =>
      r.module_name.toLowerCase() === module.toLowerCase() &&
      r.label_type === group &&
      r.label_name === key &&
      r.is_visible === "Y",
  );
}

/** The RB mandatory flag; a row without one (a seed, or no row) falls back to the field's seed default. */
function resourceRequired(
  rows: Resources,
  module: string,
  group: string,
  key: string,
  whenMissing: boolean,
) {
  const flag = rows.find(
    (r) =>
      r.module_name.toLowerCase() === module.toLowerCase() &&
      r.label_type === group &&
      r.label_name === key,
  )?.is_mandatory;
  return flag === null || flag === undefined ? whenMissing : flag === "Y";
}

/** A numeric entry of the row's `preferences` (an object, or its JSON text); undefined when absent or invalid. */
function resourcePreference(
  rows: Resources,
  module: string,
  group: string,
  key: string,
  name: string,
) {
  let prefs = rows.find(
    (r) =>
      r.module_name.toLowerCase() === module.toLowerCase() &&
      r.label_type === group &&
      r.label_name === key,
  )?.preferences;
  if (typeof prefs === "string")
    try {
      prefs = JSON.parse(prefs);
    } catch {
      return undefined;
    }
  const value =
    prefs && typeof prefs === "object"
      ? Number((prefs as Record<string, unknown>)[name])
      : NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Legacy proposals-start-page gates each filter on its `list-*` entry and labels it from the bundle. */
function proposalFilters(rows: Resources): FilterLabels {
  const keys: Record<keyof FilterLabels, [string, string]> = {
    investigator: ["list-investigator", "Investigator"],
    category: ["list-category", "Category"],
    reference: ["list-proposal-number", "Proposal Number"],
    search: ["list-title", "Title"],
    department: ["list-department", "Department"],
    sponsor: ["list-primary-sponsor", "Primary Sponsor"],
    assignedTo: ["list-assigned-to", "Assigned to"],
    activityType: ["list-activity-type", "Activity Type"],
    proposalCategory: ["list-proposal-type", "Proposal Type"],
    tags: ["list-tags", "Tags"],
    from: ["list-created-on", "Created from"],
    to: ["list-created-on-or-before", "Created through"],
  };
  return mapValues(keys, ([key, fallback]) =>
    resourceVisible(rows, "proposal", "labels", key)
      ? label(rows, "proposal", "labels", key, fallback)
      : null,
  );
}

function proposalColumns(rows: Resources): Column[] {
  const mandatory: Column[] = [
    { key: "reference", label: "Reference" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "type", label: "Record type" },
  ];
  const optional = [
    ["investigator", "list-investigator", "Investigator"],
    ["applicant", "list-applicant-name", "Applicant Name"],
    ["assignedTo", "list-assigned-to", "Assigned to"],
    ["organization", "list-department", "Department"],
    ["sponsor", "list-primary-sponsor", "Primary sponsor"],
    ["activity", "list-activity-type", "Activity Type"],
    ["category", "list-proposal-type", "Proposal Type"],
    ["created", "list-created-on", "Created On"],
    ["updated", "list-updated-on", "Updated On"],
    ["tags", "list-tags", "Tags"],
    ["start", "list-start-date", "Start date"],
    ["end", "list-end-date", "End date"],
    ["value", "list-total-cost", "Total cost"],
  ] as const;
  return [
    ...mandatory,
    ...optional
      .filter(([, key]) => resourceVisible(rows, "proposal", "labels", key))
      .map(([key, rkey, fallback]) => ({
        key,
        label: label(rows, "proposal", "labels", rkey, fallback),
      })),
  ];
}

const groupOf = new Map(
  navigationDefinitions.flatMap((item) =>
    (item.children ?? []).map((child) => [child.id, item.id] as const),
  ),
);

const groups = new Set(
  navigationDefinitions.filter((i) => i.children).map((i) => i.id),
);

/**
 * The VBCS drawer gate (getNavigationItems / getDeepLinkItems): Home, Announcements and the header pages always; a group needs
 * its own id and each child its own id too; any other item needs its id upper-cased. Missing access fails closed
 * (VBCS showed everything when access was unknown).
 */
function drawerAccess(modules: Record<string, boolean>, id: string) {
  // The header's Help and the bell's View all are always there, as legacy globalHeadersADP / the bell.
  if (
    [
      "home",
      "announcements",
      "tutorials",
      "announcements-notifications",
    ].includes(id)
  )
    return true;
  const group = groupOf.get(id);
  if (group) return modules[group] === true && modules[id] === true;
  if (groups.has(id)) return modules[id] === true;
  return modules[id.toUpperCase()] === true;
}

function visibleNavigation(
  modules: Record<string, boolean>,
  items: NavDefinition[] = navigationDefinitions,
): NavDefinition[] {
  return items.flatMap((item) =>
    drawerAccess(modules, item.id)
      ? [
          item.children
            ? {
                ...item,
                children: item.children.filter((c) =>
                  drawerAccess(modules, c.id),
                ),
              }
            : item,
        ]
      : [],
  );
}

/** A page reached from the drawer needs the same grant that shows its entry. */
function requireDrawerAccess(user: UserContext, id: string) {
  if (!drawerAccess(user.modules, id))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this module.",
      403,
    );
}

function requireModule(user: UserContext, module: string) {
  if (user.modules[module] !== true)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this module.",
      403,
    );
}

function scopeOrganization(
  requested: string | undefined,
  allowed: { id: string }[],
) {
  if (!requested) return undefined;
  if (!allowed.some((o) => o.id === requested))
    throw new AppError(
      "FORBIDDEN",
      "That organization is outside your access scope.",
      403,
    );
  return requested;
}

/** Object read: every role row for the page must grant it (as proposals objectAccess); none or any 'N' denies. */
function requireRead(
  items: { page_name: string; read_access: string | null }[],
  page: string,
) {
  const rows = items.filter((r) => r.page_name === page);
  if (rows.length === 0 || rows.some((r) => r.read_access !== "Y"))
    throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
}

/**
 * VBCS prepareRoles, fail closed: a right holds only when every row for the page grants it (as requireRead), where
 * the original let the last row win. A readable page with no numeric id has no lock level and is left out of `pages`.
 */
function objectAccessOf(rows: ObjectRoleRow[]): ObjectAccess {
  const roles = new Map<string, PageAccess>();
  const all = (
    page: string,
    key: "read_access" | "edit_access" | "delete_access",
  ) => rows.filter((r) => r.page_name === page).every((r) => r[key] === "Y");
  for (const name of new Set(rows.map((r) => r.page_name)))
    roles.set(name, {
      read: all(name, "read_access"),
      edit: all(name, "edit_access"),
      delete: all(name, "delete_access"),
    });
  const pages = [...roles]
    .filter(([, a]) => a.read)
    .flatMap(([name]) => {
      const id = rows.find(
        (r) => r.page_name === name && typeof r.page_id === "number",
      )?.page_id;
      return typeof id === "number" ? [{ id, name }] : [];
    });
  return { roles, pages };
}

/** VBCS renderLockedModules: each finalized page's name → its lock id (locks on pages the user cannot read are dropped). */
function finalizedOf(
  pages: ObjectAccess["pages"],
  locks: { id: number; page_id: number }[],
) {
  const finalized = new Map<string, number>();
  for (const l of locks) {
    const page = pages.find((p) => p.id === l.page_id);
    if (page) finalized.set(page.name, l.id);
  }
  return finalized;
}

/** Role based: every row for the page must grant it; no rows (or no roles read) denies. */
function pageAccess(roles: RoleRow[] | null, page: string) {
  const rows = (roles ?? []).filter((r) => r.page_name === page);
  return {
    read: rows.length > 0 && rows.every((r) => r.read_access === "Y"),
    edit: rows.length > 0 && rows.every((r) => r.edit_access === "Y"),
  };
}

/** A bad or missing depth degrades to no indentation rather than failing the org list. */
function orgDepth(raw: unknown) {
  const depth = Number(raw);
  return raw !== null && raw !== "" && Number.isInteger(depth) && depth > 0
    ? Math.min(depth, 20)
    : 0;
}

const orgRows = z.object({
  items: z.array(
    z.object({
      org_unit_id: z.union([z.string(), z.number()]),
      org_unit_name: z.string(),
      // Tree depth of the org (legacy NUM_SPACES); the picker indents by it.
      num_spaces: z.unknown(),
    }),
  ),
});

/** Org-unit rows (getLkpOrgUnitType, either column case) as id, name and tree depth. */
function orgUnitRows(raw: unknown) {
  const rows = (raw as { items?: Record<string, unknown>[] }).items;
  const body = orgRows.parse({
    items: rows?.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
      ),
    ),
  });
  return body.items.map((r) => ({
    id: String(r.org_unit_id),
    name: r.org_unit_name,
    depth: orgDepth(r.num_spaces),
  }));
}

// Legacy app-flow fieldLkp: each report bind's type; anything unlisted is a string.
const REPORT_BINDS: Record<string, "NUM" | "DT"> = {
  proposal_id: "NUM",
  object_id: "NUM",
  conv_rate: "NUM",
  costing_header_id: "NUM",
  org_id: "NUM",
  creation_date: "DT",
  app_fund_id: "NUM",
  fy_code: "NUM",
  unit_id: "NUM",
};
type Bind = string | number | null;
/** Legacy generateReportPayload: `{ report_code, binds: { name: { type, value } } }` for generate-report. */
function reportPayload(code: string, binds: Record<string, Bind>) {
  return {
    report_code: code,
    binds: Object.fromEntries(
      Object.entries(binds).map(([key, value]) => {
        const type = REPORT_BINDS[key];
        return [
          key,
          type === "NUM"
            ? { type: "NUMBER", value: value ? Number(value) : value }
            : type === "DT"
              ? { type: "DATE", value }
              : { type: "VARCHAR2", value: `${value}` },
        ];
      }),
    ),
  };
}

export const serverFunctions = {
  reports: { reportPayload },
  async: { early, bounded },
  sanitize: { plainText, sanitizeHtml },
  choices: { statusChoices, objectDateChoices, nameChoices, choiceList },
  resources: {
    mergeResourceDefaults,
    label,
    resourceDescription,
    resourceVisible,
    resourceRequired,
    resourcePreference,
    proposalFilters,
    proposalColumns,
  },
  permissions: {
    drawerAccess,
    visibleNavigation,
    requireDrawerAccess,
    requireModule,
    scopeOrganization,
    requireRead,
    objectAccessOf,
    finalizedOf,
    pageAccess,
  },
  organizations: { orgDepth, orgUnitRows },
};
