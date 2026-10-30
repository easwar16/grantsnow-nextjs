import "server-only";
import type { Resources } from "@/server/platform/configuration/resources";
import type { FundShellModel } from "@/features/modules/claims/funds/types";
import {
  CLAIMS_STATUS,
  FUND_TAB_DEFS,
  type FundTab,
} from "@/shared/claims/fund-record";
import { label } from "../listing";
import { fundFilterChoices, type FundRecordContext } from "../record";

/** A tab's name: the bundle's `page-name.<key>`, else legacy's fallback. */
export const tabName = (rows: Resources, tab: FundTab) =>
  label(rows, "page-name", FUND_TAB_DEFS[tab].key, FUND_TAB_DEFS[tab].name);

/** The record shell (legacy claims-funds-inquiry-info-page): its tabs, filter bar, Export and labels. */
export async function fundShell(
  context: FundRecordContext,
  rows: Resources,
): Promise<FundShellModel> {
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const { functions, objects } = await fundFilterChoices();
  return {
    appFundId: context.id,
    tabs: context.tabs.map((tab) => ({ tab, name: tabName(rows, tab) })),
    filters: {
      functions,
      objects,
      statuses: CLAIMS_STATUS.map((s) => ({ ...s })),
    },
    canExport: context.access.roles.get("claims-export")?.read === true,
    labels: {
      list: t("button-labels", "list", "List"),
      export: t("button-labels", "fund-export", "Export"),
      func: t("labels", "details-function", "Function"),
      object: t("labels", "details-object", "Object"),
      status: t("labels", "details-status", "Status"),
      tabs: "Fund pages",
    },
  };
}
