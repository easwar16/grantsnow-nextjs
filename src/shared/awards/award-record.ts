import type { StatusTone } from "@/components/ui/status-badge";
import type { IconName } from "@/components/ui/icon";
import type { ObjectAccess } from "@/server/platform/permissions";
import type { PageLock } from "@/shared/opportunities/eoi-record";
/** The record's backend object type: roles, finalizable pages, locks, comments and audit. */
export const AWARD_MODULE = "AWARD";
/** Legacy `editableStatuses` (global EDITABLE_STATUS, DRFT by default): only a draft is edited or finalized. */
export const EDITABLE_STATUSES = ["DRFT"];
/** Legacy getTabs order (awards-detail-page.js); the URL segment is the page name without `awards-`. */
export const awardTabs = [
  "header",
  "budget-periods",
  "projects",
  "credit-allocation",
  "installments",
  "dynamic-form-1",
  "dynamic-form-2",
  "dynamic-form-3",
  "dynamic-form-4",
  "dynamic-form-5",
  "attachments",
  "due-diligence",
  "approvals",
  "milestones",
  "history",
  "delegation",
  "report",
] as const;
export type AwardTab = (typeof awardTabs)[number];
export type AwardFormTab = Extract<AwardTab, `dynamic-form-${string}`>;
export const pageOf = (tab: AwardTab) => `awards-${tab}`;
export const isFormTab = (tab: AwardTab): tab is AwardFormTab =>
  tab.startsWith("dynamic-form-");
/** A dynamic-form tab's form: AWARD with the page name upper-cased as the slot (legacy AWARDS-DYNAMIC-FORM-n). */
export const formSlotOf = (tab: AwardFormTab) => pageOf(tab).toUpperCase();
/** Names (`page-name` key, legacy fallback) and icons (legacy getTabs). */
export const AWARD_TAB_DEFS: Record<
  AwardTab,
  { key: string; name: string; icon: IconName }
> = {
  header: {
    key: "award-header",
    name: "Award Header",
    icon: "document-attachment",
  },
  "budget-periods": {
    key: "awards-budget-periods",
    name: "Budget Periods",
    icon: "money",
  },
  projects: { key: "awards-projects", name: "Projects", icon: "file-stage" },
  // Legacy built the page but never listed the tab (no getTabs entry); DEV grants awards-credit-allocation.
  "credit-allocation": {
    key: "awards-credit-allocation",
    name: "Credit Allocation",
    icon: "split",
  },
  installments: {
    key: "awards-installments",
    name: "Installments",
    icon: "money",
  },
  "dynamic-form-1": {
    key: "awards-dynamic-form-1",
    name: "Dynamic Form 1",
    icon: "due-diligence",
  },
  "dynamic-form-2": {
    key: "awards-dynamic-form-2",
    name: "Dynamic Form 2",
    icon: "comment",
  },
  "dynamic-form-3": {
    key: "awards-dynamic-form-3",
    name: "Dynamic Form 3",
    icon: "comment",
  },
  "dynamic-form-4": {
    key: "awards-dynamic-form-4",
    name: "Dynamic Form 4",
    icon: "comment",
  },
  "dynamic-form-5": {
    key: "awards-dynamic-form-5",
    name: "Dynamic Form 5",
    icon: "comment",
  },
  attachments: {
    key: "awards-attachments",
    name: "Attachments",
    icon: "attachment",
  },
  "due-diligence": {
    key: "awards-due-diligence",
    name: "Due Diligence",
    icon: "due-diligence",
  },
  approvals: { key: "awards-approvals", name: "Approvals", icon: "workflow" },
  milestones: {
    key: "awards-milestones",
    name: "Milestones",
    icon: "workflow",
  },
  history: { key: "awards-history", name: "History", icon: "clock-history" },
  delegation: { key: "awards-delegation", name: "Delegation", icon: "action" },
  report: { key: "awards-report", name: "Project Report", icon: "report" },
};

/**
 * Legacy getTabs: each tab needs read on its page (fail closed; legacy showed every tab with no roles). Approvals also
 * needs the award in approval or past it (AIA, IA, SUB), or every finalizable page but Approvals finalized.
 */
export function visibleTabs(
  access: ObjectAccess,
  status: string,
  finalizable: string[] | null,
  finalized: ReadonlySet<string>,
): AwardTab[] {
  return awardTabs.filter((tab) => {
    if (access.roles.get(pageOf(tab))?.read !== true) return false;
    if (tab !== "approvals") return true;
    if (["AIA", "IA", "SUB"].includes(status)) return true;
    return (
      finalizable !== null &&
      finalizable
        .filter((p) => p !== pageOf("approvals"))
        .every((p) => finalized.has(p))
    );
  });
}

/** The panel's Finalize checkbox: a draft's finalizable page whose lock is known; on when it is finalized. */
export function finalizeSwitch(
  status: string,
  finalizable: string[] | null,
  finalized: ReadonlySet<string>,
  tab: AwardTab,
  lock: PageLock | undefined,
) {
  if (
    !EDITABLE_STATUSES.includes(status) ||
    lock?.known !== true ||
    !finalizable?.includes(pageOf(tab))
  )
    return null;
  return { on: finalized.has(pageOf(tab)) };
}

/** Legacy badge colours by status code (awards-start-page and the record panel): AIA warning, IA success, any other the plain badge. */
export const AWARD_STATUS_TONE: Record<string, StatusTone> = {
  AIA: "warning",
  IA: "success",
};
