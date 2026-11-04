import type { IconName } from "@/components/ui/icon";

/** Unit Inquiry's object type: roles, attachments and audits are keyed by the application (`app_id`). */
export const UNIT_MODULE = "CLAIMS";

/**
 * Legacy claims-unit-inquiry-info-page getTabs, in order, as far as they are built: Claims joins when it lands (only implemented tabs appear).
 */
export const unitTabs = [
  "summary",
  "goals",
  "activities",
  "attachments",
] as const;
export type UnitTab = (typeof unitTabs)[number];
export const UNIT_TAB_DEFS: Record<
  UnitTab,
  { key: string; name: string; icon: IconName }
> = {
  summary: { key: "unit-summary", name: "Summary", icon: "analytics" },
  goals: { key: "unit-goals", name: "Goals", icon: "money" },
  activities: {
    key: "unit-activities",
    name: "Activities",
    icon: "deposits",
  },
  attachments: {
    key: "unit-attachments",
    name: "Attachments",
    icon: "attachment",
  },
};
/** The role row (`page_name`) that opens a tab. */
export const pageOf = (tab: UnitTab) => `claims-${UNIT_TAB_DEFS[tab].key}`;

/** The Summary tab's sign-off lists (legacy signOffTabs), each read when it is opened. */
export const signOffViews = ["stakeholders", "meetings", "documents"] as const;
export type SignOffView = (typeof signOffViews)[number];

/** The Activities tab's own tabs (legacy activityTabs), as far as they are built. */
export const activityViews = [
  "fund-summary",
  "activities-list",
  "activity-details",
] as const;
export type ActivityView = (typeof activityViews)[number];
