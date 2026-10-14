import "server-only";
import { cache } from "react";
import { z } from "zod";
import { oracle } from "@/server/api/transport";
import { authenticate } from "@/server/session/service";
import type { Column } from "@/features/proposals/types";
import sourceDefaults from "./resource-defaults.json";
const resource = z.object({
  module_name: z.string(),
  label_type: z.string(),
  label_name: z.string(),
  label_value: z.string().nullish(),
  is_visible: z.enum(["Y", "N"]).nullish(),
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
  return mergeResourceDefaults(
    await oracle("getSharedLabels", {
      token: session.token,
      module_name:
        "DASHBOARD,PROPOSAL,OUTLINE_PROPOSAL,SUB_PROPOSAL,EXTENSION_PROPOSAL,OPPORTUNITIES-EOI",
    }),
  );
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
      .filter(([, key]) =>
        rows.some(
          (r) =>
            r.module_name.toLowerCase() === "proposal" &&
            r.label_type === "labels" &&
            r.label_name === key &&
            r.is_visible === "Y",
        ),
      )
      .map(([key, rkey, fallback]) => ({
        key,
        label: label(rows, "proposal", "labels", rkey, fallback),
      })),
  ];
}
