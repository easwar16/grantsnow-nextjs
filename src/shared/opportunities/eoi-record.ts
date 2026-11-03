import type { StatusTone } from "@/components/ui/status-badge";
import type { IconName } from "@/components/ui/icon";
import type { ObjectAccess } from "@/server/platform/permissions";
/** The record's backend object type: roles, finalizable pages and module locks. */
export const EOI_MODULE = "OPPORTUNITIES-EOI";
/** `$application.variables.editableStatuses`: only a draft can be edited or finalized. */
export const EDITABLE_STATUSES = ["DRFT"];
/** Attachments may also change while the application is sent back for rework (owner, 2026-10-23). */
export const ATTACHMENT_STATUSES = ["DRFT", "REWORK"];
/** getTabs' order (GN-Angular EOI_TABS); the URL segment is the page name without its `opportunities-eoi-` prefix. */
export const eoiTabs = [
  "summary",
  "application",
  "dynamic-form-1",
  "dynamic-form-2",
  "dynamic-form-3",
  "dynamic-form-4",
  "dynamic-form-5",
  "approvals",
  "attachments",
  "history",
  "delegation",
] as const;
export type EoiTab = (typeof eoiTabs)[number];
export type FormTab = Extract<EoiTab, `dynamic-form-${string}`>;
export const pageOf = (tab: EoiTab) => `opportunities-eoi-${tab}`;
export const isFormTab = (tab: EoiTab): tab is FormTab =>
  tab.startsWith("dynamic-form-");
/** Fallback names and icons; the bundle's `page-name.<page>` wins for the name. */
export const EOI_TAB_DEFS: Record<EoiTab, { name: string; icon: IconName }> = {
  summary: { name: "Summary", icon: "document-attachment" },
  application: { name: "Application Details", icon: "pen" },
  "dynamic-form-1": { name: "Dynamic Form 1", icon: "comment" },
  "dynamic-form-2": { name: "Dynamic Form 2", icon: "comment" },
  "dynamic-form-3": { name: "Dynamic Form 3", icon: "comment" },
  "dynamic-form-4": { name: "Dynamic Form 4", icon: "comment" },
  "dynamic-form-5": { name: "Dynamic Form 5", icon: "comment" },
  approvals: { name: "Workflow", icon: "action" },
  attachments: { name: "Attachments", icon: "attachment" },
  history: { name: "History", icon: "clock-history" },
  delegation: { name: "Delegation", icon: "action" },
};
/**
 * VBCS getTabs. `access` null is a new application (no request yet): only Summary and Application, as the forms,
 * attachments, history and delegation need a saved request.
 * Workflow needs read and every finalizable page finalized, or nothing to finalize and a request; an unknown
 * finalizable list (`null`, the read failed) hides it.
 */
export function visibleTabs(
  access: ObjectAccess | null,
  finalizable: string[] | null,
  finalized: ReadonlySet<string>,
): EoiTab[] {
  const hasRequest = access !== null;
  return eoiTabs.filter((tab) => {
    if (!hasRequest) return tab === "summary" || tab === "application";
    if (access.roles.get(pageOf(tab))?.read !== true) return false;
    if (tab === "approvals")
      return (
        finalizable !== null &&
        (finalizable.length > 0
          ? finalizable.every((p) => finalized.has(p))
          : true)
      );
    return true;
  });
}
/** A page's lock as the record page uses it; `known` false when getLockStatus could not be read. */
export interface PageLock {
  known: boolean;
  locked: boolean;
}
/** The record panel's Finalize checkbox: a draft's finalizable page whose lock is known; on when it is finalized. */
export function finalizeSwitch(
  statusCode: string | null | undefined,
  finalizable: string[] | null,
  finalized: ReadonlySet<string>,
  tab: EoiTab,
  lock: PageLock | undefined,
) {
  if (
    !EDITABLE_STATUSES.includes(statusCode ?? "") ||
    lock?.known !== true ||
    !finalizable?.includes(pageOf(tab))
  )
    return null;
  return { on: finalized.has(pageOf(tab)) };
}
/** The Application tab's own Create / Save: a new application, or a draft being edited. */
export const canSaveApplication = (
  requestId: string | undefined,
  editing: boolean,
  statusCode: string | undefined,
) =>
  requestId === undefined ||
  (editing && EDITABLE_STATUSES.includes(statusCode ?? ""));
/** Header converts: an approved (IA) application and the record role for each. */
export function headerConverts(
  statusCode: string | null | undefined,
  access: ObjectAccess,
) {
  const approved = statusCode === "IA";
  return {
    outline:
      approved &&
      access.roles.get("eoi-convert-outline-proposal")?.read === true,
    full:
      approved && access.roles.get("eoi-convert-full-proposal")?.read === true,
  };
}
/**
 * The dynamic form a tab hosts: the Application is `OPPORTUNITIES` / `OPPORTUNITIES-EOI-APPLICATION`; Dynamic Form
 * 1–5 are `OPPORTUNITIES-EOI` with the page name upper-cased as the slot (the original's page id).
 */
export function formOf(tab: "application" | FormTab) {
  return tab === "application"
    ? { objectType: "OPPORTUNITIES", slot: "OPPORTUNITIES-EOI-APPLICATION" }
    : { objectType: EOI_MODULE, slot: pageOf(tab).toUpperCase() };
}
/** The original's oj-badge colours by status code; any other status is the plain badge. */
export const EOI_STATUS_TONE: Record<string, StatusTone> = {
  IA: "info",
  REJ: "danger",
  AWARD: "success",
  AIA: "warning",
};
