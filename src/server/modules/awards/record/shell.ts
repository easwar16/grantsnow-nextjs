import "server-only";
import { type Resources } from "@/server/platform/configuration/resources";
import { type FormatSettings } from "@/lib/format";
import type { AwardShellModel } from "@/features/modules/awards/record/types";
import {
  AWARD_STATUS_TONE,
  AWARD_TAB_DEFS,
  awardTabs,
  pageOf,
  type AwardTab,
} from "@/shared/awards/award-record";
import { isDraft, type AwardRecordContext } from "../record";
import { canSendToErp } from "./erp";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
const BUNDLE = "award";
const textOf =
  (rows: Resources) => (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
/** A tab's name: the bundle's `page-name.<key>`, else legacy's fallback. */
export const tabName = (rows: Resources, tab: AwardTab) =>
  textOf(rows)("page-name", AWARD_TAB_DEFS[tab].key, AWARD_TAB_DEFS[tab].name);

/**
 * The record shell (legacy awards-detail-page): tabs, the panel (each row shown when it has a value and its
 * `labels.<key>` is visible), finalize and labels. Legacy's Send to ERP is not offered: its OIC flow has no path in
 * the contract.
 */
export function awardShell(
  context: AwardRecordContext,
  rows: Resources,
  format: (FormatSettings & { currency?: string }) | undefined,
): AwardShellModel {
  const t = textOf(rows);
  const a = context.award;
  const status = a.award_status ?? "";
  const shown = (key: string) =>
    serverFunctions.resources.resourceVisible(rows, BUNDLE, "labels", key);
  const cells: [string, string, string, string | null | undefined][] = [
    ["award-title", "award-title", "Award Title", a.award_name],
    ["award-number", "award-number", "Award Number", a.award_number],
    [
      "erp-award-id",
      "detail-erp-award-id",
      "ERP Award Id",
      status === "STE" ? a.erp_award_id : null,
    ],
    ["proposal-title", "proposal-title", "Proposal Title", a.full_title],
  ];
  const panel: AwardShellModel["panel"] = cells
    .filter(([, key, , value]) => value && shown(key))
    .map(([cell, key, fallback, value]) => ({
      key: cell,
      label: t("labels", key, fallback),
      value: value!,
    }));
  if (a.proposal_number && shown("parent-proposal-number"))
    panel.push({
      key: "parent-proposal",
      label: t("labels", "parent-proposal-number", "Parent proposal number"),
      value: a.proposal_number,
      href: a.proposal_id
        ? `/proposals/PROPOSAL/${Number(a.proposal_id)}`
        : undefined,
    });
  // Legacy shows the amount only when truthy, so a zero amount is left out.
  if (Number(a.award_amount) && shown("award-amount"))
    panel.push({
      key: "amount",
      label: t("labels", "award-amount", "Amount"),
      value: functions.format.moneyDisplay(
        String(a.award_amount),
        format?.currency,
        format,
      ),
    });
  const rest: [string, string, string, string | null | undefined][] = [
    ["funder", "detail-funder", "Funder", a.sponsor_party_name],
    [
      "billing-party",
      "detail-billing-party",
      "Billing Party",
      a.billing_party_name,
    ],
  ];
  for (const [cell, key, fallback, value] of rest)
    if (value && shown(key))
      panel.push({ key: cell, label: t("labels", key, fallback), value });
  if (a.award_status_desc && shown("award-status"))
    panel.push({
      key: "status",
      label: t("labels", "award-status", "Status"),
      value: a.award_status_desc,
      tone: AWARD_STATUS_TONE[status] ?? "neutral",
    });
  if (context.pi && shown("created-by"))
    panel.push({
      key: "created-by",
      label: t("labels", "created-by", "Created by"),
      value: context.pi,
      creator: true,
    });
  if (context.orgName && shown("org-unit"))
    panel.push({
      key: "org-unit",
      label: t("labels", "org-unit", "Org Unit"),
      value: context.orgName,
    });
  // Each panel label's More Info (legacy infoFld* buttons), from the same RB key as its label.
  const rbKey: Record<string, string> = {
    "erp-award-id": "detail-erp-award-id",
    "parent-proposal": "parent-proposal-number",
    amount: "award-amount",
    funder: "detail-funder",
    "billing-party": "detail-billing-party",
    status: "award-status",
  };
  for (const cell of panel)
    cell.help = serverFunctions.resources.resourceDescription(
      rows,
      BUNDLE,
      "labels",
      rbKey[cell.key] ?? cell.key,
    );
  const editable = a.is_editable === true || Number(a.is_editable) === 1;
  return {
    awardId: context.id,
    statusCode: status,
    tabs: context.tabs.map((tab) => ({
      tab,
      name: tabName(rows, tab),
      icon: AWARD_TAB_DEFS[tab].icon,
      finalized: context.finalized.has(pageOf(tab)),
    })),
    panel,
    finalizable:
      context.finalizable === null
        ? null
        : awardTabs.filter((tab) => context.finalizable!.includes(pageOf(tab))),
    canSendToErp: canSendToErp(status, context.access),
    canEditHeader:
      editable &&
      isDraft(context) &&
      context.access.roles.get(pageOf("header"))?.edit === true,
    labels: {
      list: t("button-labels", "list", "List"),
      editHeader: t("button-labels", "edit-award-header", "Edit Award Header"),
      sendToErp: t("button-labels", "send-to-erp", "Send to ERP"),
      save: t("button-labels", "save", "Save"),
      cancel: t("button-labels", "cancel", "Cancel"),
      comments: t("button-labels", "comments", "Comments"),
      audit: serverFunctions.resources.resourceVisible(
        rows,
        BUNDLE,
        "button-labels",
        "openAuditTrail",
      )
        ? t("button-labels", "openAuditTrail", "Open Audit Trail")
        : null,
      auditTitle: t("header-labels", "audit-trail", "Audit Trail"),
      close: t("button-labels", "close", "Close"),
      finalize: t("labels", "finalize", "Finalize"),
      finalized: t("aria-labels", "finalized", "Finalized"),
      tabs: t("aria-labels", "award-tabs", "Award pages"),
    },
  };
}
