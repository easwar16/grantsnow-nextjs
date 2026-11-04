import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import type { Resources } from "@/server/platform/configuration/resources";
import type { UnitShellModel } from "@/features/modules/claims/units/types";
import { UNIT_TAB_DEFS, type UnitTab } from "@/shared/claims/unit-record";
import { label, numberish, optionalText } from "../listing";
import type { UnitRecordContext } from "../record";

const text = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/** Every app-summary column (the shape DEV answers): Save sends this row back with its edits, as legacy sends `summary`. */
export const appSummaryRow = z.object({
  app_id: numberish,
  unit_id: numberish,
  org_unit_code: optionalText,
  org_unit_name: optionalText,
  fy_code: numberish,
  program_type_code: optionalText,
  unit_category: optionalText,
  program_preparer_name: optionalText,
  program_preparer_title: optionalText,
  program_preparer_email: optionalText,
  program_preparer_phone: optionalText,
  cfo_controller_name: optionalText,
  cfo_controller_email: optionalText,
  cfo_controller_phone: optionalText,
  school_admin_name: optionalText,
  school_admin_sign_date: optionalText,
  board_member_name: optionalText,
  board_member_sign_date: optionalText,
  parent_rep_name: optionalText,
  parent_rep_sign_date: optionalText,
  network_chief_name: optionalText,
  org_id: numberish,
  created_by: numberish,
  creation_date: optionalText,
  last_updated_by: numberish,
  last_update_date: optionalText,
});
export type AppSummaryRow = z.infer<typeof appSummaryRow>;
/** The application's header row; legacy shows "Couldn't fetch Summary" when it is missing. */
export async function appSummaryOf(context: UnitRecordContext) {
  const row = z.object({ items: z.array(appSummaryRow) }).parse(
    await claims.appSummary({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  ).items[0];
  if (!row) throw new AppError("CONTRACT", "Couldn't fetch Summary");
  return row;
}

/** A tab's name: the bundle's `page-name.<key>`, else legacy's fallback. */
export const tabName = (rows: Resources, tab: UnitTab) =>
  label(rows, "page-name", UNIT_TAB_DEFS[tab].key, UNIT_TAB_DEFS[tab].name);

/** The record shell (legacy claims-unit-inquiry-info-page): tabs and the detailsForm panel. */
export async function unitShell(
  context: UnitRecordContext,
  rows: Resources,
): Promise<UnitShellModel> {
  const t = (key: string, fallback: string) =>
    label(rows, "labels", key, fallback);
  const s = await appSummaryOf(context);
  return {
    appId: context.id,
    tabs: context.tabs.map((tab) => ({ tab, name: tabName(rows, tab) })),
    // Legacy oj-form-layout columns="2" direction="column": Unit, Fiscal Year, then Program Type.
    panel: [
      {
        key: "unit",
        label: t("unit-details-unitData", "Unit"),
        value: `${text(s.unit_id)} - ${text(s.org_unit_name)}`,
      },
      {
        key: "fiscal-year",
        label: t("unit-details-fiscalYear", "Fiscal Year"),
        value: text(s.fy_code),
      },
      {
        key: "program-type",
        label: t("unit-details-programType", "Program Type"),
        value: text(s.program_type_code),
      },
    ],
    labels: {
      list: label(rows, "button-labels", "list", "List"),
      tabs: "Application pages",
    },
  };
}
