import "server-only";
import {
  label,
  resourceVisible,
  type Resources,
} from "@/server/configuration/resources";
import { dateDisplay, type FormatSettings } from "@/lib/format";
import type {
  RecordShellModel,
  RecordTabLink,
} from "@/features/opportunities/eoi/types";
import type { EoiRecordContext } from "../record";
import {
  EOI_STATUS_TONE,
  EOI_TAB_DEFS,
  eoiTabs,
  headerConverts,
  pageOf,
  type EoiTab,
} from "./model";
const BUNDLE = "opportunities-eoi";
const textOf =
  (rows: Resources) => (group: string, key: string, fallback: string) =>
    label(rows, BUNDLE, group, key, fallback);
/** A tab's name: the bundle's `page-name.<page>`, else the original's fallback. */
export const tabName = (rows: Resources, tab: EoiTab) =>
  textOf(rows)("page-name", pageOf(tab), EOI_TAB_DEFS[tab].name);
function tabLinks(
  rows: Resources,
  tabs: EoiTab[],
  finalized: ReadonlyMap<string, number>,
): RecordTabLink[] {
  return tabs.map((tab) => ({
    tab,
    name: tabName(rows, tab),
    icon: EOI_TAB_DEFS[tab].icon,
    finalized: finalized.has(pageOf(tab)),
  }));
}
function labels(rows: Resources): RecordShellModel["labels"] {
  const t = textOf(rows);
  return {
    list: t("button-labels", "eoi-list", "List"),
    edit: "Edit Application",
    saveDraft: t("labels", "eoi-save-as-draft", "Save as draft"),
    cancelEdit: "Cancel Edit",
    comments: t("button-labels", "comments", "Comments"),
    audit: resourceVisible(rows, BUNDLE, "button-labels", "openAuditTrail")
      ? t("button-labels", "openAuditTrail", "Open Audit Trail")
      : null,
    auditTitle: t("header-labels", "audit-trail", "Audit Trail"),
    close: t("button-labels", "eoi-comments-close", "Close"),
    finalize: t("labels", "finalize", "Finalize"),
    finalized: t("aria-labels", "finalized", "Finalized"),
    tabs: t("aria-labels", "eoi-tabs", "Application pages"),
    deniedTitle: "Access denied",
    deniedPage: "You do not have access to this page.",
  };
}
/** A saved application: tabs, record panel (each cell behind its `labels.eoi-*` gate), finalize and converts. */
export function recordShell(
  context: EoiRecordContext,
  rows: Resources,
  format: FormatSettings | undefined,
): RecordShellModel {
  const t = textOf(rows);
  const shown = (key: string) => resourceVisible(rows, BUNDLE, "labels", key);
  const r = context.request;
  const converts = headerConverts(r.status_code, context.access);
  const panel: RecordShellModel["panel"] = [];
  if (shown("eoi-application-number"))
    panel.push({
      key: "number",
      label: t("labels", "eoi-application-number", "Application Number"),
      value: r.request_number,
    });
  if (r.status && shown("eoi-status"))
    panel.push({
      key: "status",
      label: t("labels", "eoi-status", "EOI Status"),
      value: r.status,
      tone: EOI_STATUS_TONE[r.status_code ?? ""] ?? "neutral",
    });
  if (shown("eoi-created-by"))
    panel.push({
      key: "created-by",
      label: t("labels", "eoi-created-by", "Created by"),
      value: context.createdBy ?? "—",
    });
  if (r.creation_date && shown("eoi-created-on"))
    panel.push({
      key: "created-on",
      label: t("labels", "eoi-created-on", "Created on"),
      value: dateDisplay(r.creation_date, format),
    });
  return {
    mode: "record",
    base: `/opportunities/eoi/${context.id}`,
    listHref: "/opportunities/eoi",
    requestId: context.id,
    number: r.request_number,
    statusCode: r.status_code ?? undefined,
    opportunityId: context.opportunity
      ? String(context.opportunity.opportunities_id)
      : undefined,
    opportunityHeading: context.opportunity?.opp_heading,
    tabs: tabLinks(rows, context.tabs, context.finalized),
    panel,
    finalizable:
      context.finalizable === null
        ? null
        : eoiTabs.filter((tab) => context.finalizable!.includes(pageOf(tab))),
    converts: {
      outline: converts.outline
        ? t("button-labels", "eoi-convert-to-proposal", "Convert to proposal")
        : null,
      full: converts.full
        ? t(
            "button-labels",
            "eoi-convert-to-full-proposal",
            "Convert to Full Proposal",
          )
        : null,
    },
    labels: labels(rows),
  };
}
/** A new application or More Info: no request, so no panel, comments, finalize or converts; List goes to the finder. */
export function openingShell(
  mode: "new" | "detail",
  opportunityId: string,
  heading: string,
  rows: Resources,
): RecordShellModel {
  return {
    mode,
    base:
      mode === "new"
        ? `/opportunities/eoi/new/${opportunityId}`
        : `/opportunities/${opportunityId}`,
    listHref: "/opportunities",
    opportunityId,
    opportunityHeading: heading,
    tabs:
      mode === "new"
        ? tabLinks(rows, ["summary", "application"], new Map())
        : [],
    panel: [],
    finalizable: null,
    converts: { outline: null, full: null },
    labels: labels(rows),
  };
}
