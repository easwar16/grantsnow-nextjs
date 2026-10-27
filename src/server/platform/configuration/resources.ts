import "server-only";
import { AppError } from "@/lib/errors";
import { cache } from "react";
import { memo, memoKey, TTL } from "@/server/oracle/cache";
import { z } from "zod";
import merge from "lodash/merge";
import mapValues from "lodash/mapValues";
import { configuration } from "@/server/oracle/api";
import { sanitizeHtml } from "@/server/platform/sanitize";
import { authenticate } from "@/server/identity/session/service";
import type { Column, FilterLabels } from "@/features/modules/proposals/types";
import sourceDefaults from "./resource-defaults.json";
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
export function mergeResourceDefaults(raw: unknown) {
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
/** Legacy shell-page findModuleAccess: the bundles a user's modules need, DASHBOARD always. */
const MODULE_BUNDLES: Record<string, string[]> = {
  "opportunities-group": ["OPPORTUNITIES-EOI"],
  // Outline proposals are reached through EOI Convert and shared links, so their bundle loads with PROPOSALS (8336).
  PROPOSALS: [
    "PROPOSAL",
    "SUB_PROPOSAL",
    "EXTENSION_PROPOSAL",
    "OUTLINE_PROPOSAL",
  ],
  OUTLINE_PROPOSAL: ["OUTLINE_PROPOSAL"],
  ETHICS: ["ETHICS"],
  AWARDS: ["AWARD"],
  CONTRACTS: ["CONTRACT"],
  "DUE-DILIGENCE": ["DUE_DILIGENCE"],
};
export function labelBundles(modules: Record<string, boolean>) {
  return [
    ...new Set([
      "DASHBOARD",
      ...Object.keys(modules)
        .filter((m) => modules[m] === true)
        .flatMap((m) => MODULE_BUNDLES[m] ?? []),
    ]),
  ].join(",");
}
export const resources = cache(async () => {
  const { session, user } = await authenticate();
  // The merged bundle (seeds included, or seeds alone) is held for a few minutes: labels change only by admin edits.
  return memo(memoKey("labels", session.token), TTL.config, async () => {
    let rows: unknown = [];
    try {
      rows = await configuration.labels(
        { bundles: labelBundles(user.modules) },
        { token: session.token },
      );
    } catch (e) {
      // Legacy merges backend rows over the seeds; with the labels call unreachable the seeds alone render.
      if (!(e instanceof AppError && e.code === "UPSTREAM")) throw e;
    }
    return mergeResourceDefaults(rows);
  });
});
export type Resources = Awaited<ReturnType<typeof resources>>;
export function label(
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
export function resourceDescription(
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
export function resourceVisible(
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
export function resourceRequired(
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
export function resourcePreference(
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
export function proposalFilters(rows: Resources): FilterLabels {
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
export function proposalColumns(rows: Resources): Column[] {
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
