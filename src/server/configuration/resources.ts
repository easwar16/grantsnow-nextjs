import "server-only";
import { AppError } from "@/lib/errors";
import { cache } from "react";
import { z } from "zod";
import { oracle } from "@/server/api/transport";
import { sanitizeHtml } from "@/server/html/sanitize";
import { authenticate } from "@/server/session/service";
import type { Column } from "@/features/proposals/types";
import sourceDefaults from "./resource-defaults.json";
const resource = z.object({
  module_name: z.string(),
  label_type: z.string(),
  label_name: z.string(),
  label_value: z.string().nullish(),
  label_description: z.string().nullish(),
  is_visible: z.enum(["Y", "N"]).nullish(),
  // Seeds carry no flag, so a missing one means "use the field's seed default" (resourceRequired).
  is_mandatory: z.string().nullish(),
  preferences: z.unknown().optional(),
});
export function mergeResourceDefaults(raw: unknown) {
  const overrides = z.array(resource).parse(raw);
  const key = (r: z.infer<typeof resource>) =>
    `${r.module_name.toLowerCase()}:${r.label_type}:${r.label_name}`;
  const merged = new Map(
    z
      .array(resource)
      .parse(sourceDefaults)
      .map((r) => [key(r), r]),
  );
  for (const row of overrides) merged.set(key(row), row);
  return [...merged.values()];
}
export const resources = cache(async () => {
  const { session } = await authenticate();
  let rows: unknown = [];
  try {
    rows = await oracle("getSharedLabels", {
      token: session.token,
      module_name:
        "DASHBOARD,PROPOSAL,OUTLINE_PROPOSAL,SUB_PROPOSAL,EXTENSION_PROPOSAL,OPPORTUNITIES-EOI",
    });
  } catch (e) {
    // Legacy merges backend rows over the seeds; with the labels call unreachable the seeds alone render.
    if (!(e instanceof AppError && e.code === "UPSTREAM")) throw e;
  }
  return mergeResourceDefaults(rows);
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
