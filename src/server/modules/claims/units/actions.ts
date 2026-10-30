import "server-only";
import { z } from "zod";
import { claims, lookups, reports } from "@/server/oracle/api";
import type { Resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import type { UnitFilters } from "@/features/modules/claims/units/schema";
import type {
  FundTypeOption,
  GrantChoices,
  UnitCloneSetup,
  UnitDialogField,
  UnitDialogSetup,
} from "@/features/modules/claims/units/types";

import {
  BUNDLE,
  LOOKUPS,
  actor,
  fundRow,
  label,
  listGates,
  lookupOptions,
  numberish,
  orgUnitOptions,
  requireGate,
  optionalText,
  unitQuery,
  visible,
  visibleUnit,
} from "./listing";

/** A saved fund may be changed or removed only while its status is one of these (legacy fund table actions). */
const OPEN_FUND = ["DRFT", "REWORK"];

// ── Create / Update ─────────────────────────────────────────────────────────

const DIALOG: Record<UnitDialogField, [string, string]> = {
  unit: ["create-org-unit", "Org Unit"],
  year: ["create-fiscal-year", "Fiscal Year"],
  program: ["create-program-type", "Program Type"],
  fundType: ["create-fund-type", "Fund Type"],
  grant: ["grant-value-id", "Grant"],
  account: ["payment-account-code", "Payment Account Code"],
  start: ["grant-period-start", "Grant Period Start"],
  end: ["grant-period-end", "Grant Period End"],
  amendmentDate: ["amendment-date", "Last Date for Amendment"],
  claimDate: ["claim-date", "Last Date for Claim"],
};
function dialogGates(rows: Resources) {
  const gate = (key: string) => ({
    show: visible(rows, "labels", key),
    required: serverFunctions.resources.resourceRequired(
      rows,
      BUNDLE,
      "labels",
      key,
      false,
    ),
  });
  return {
    grant: gate("grant-value-id"),
    account: gate("payment-account-code"),
  };
}

/** The Create / Update Unit dialog's labels, gated fields and program types. */
export async function unitDialogSetup(): Promise<UnitDialogSetup> {
  const { rows, actions } = await actor();
  requireGate(actions.create || actions.edit);
  const header = (key: string, fallback: string) =>
    label(rows, "table-headers", key, fallback);
  return {
    labels: Object.fromEntries(
      Object.entries(DIALOG).map(([k, [key, fallback]]) => [
        k,
        label(rows, "labels", key, fallback),
      ]),
    ) as Record<UnitDialogField, string>,
    ...dialogGates(rows),
    headers: {
      fund: header("fund-name", "Fund Name"),
      start: header("grant-period-start", "Grant Period Start"),
      end: header("grant-period-end", "Grant Period End"),
      amendmentDate: header("amendment-date", "Last Date for Amendment"),
      claimDate: header("claim-date", "Last Date for Claim"),
      grant: header("grant-value-id", "Grant"),
      account: header("payment-account-code", "Payment Account Code"),
    },
    texts: {
      createTitle: label(
        rows,
        "dialog-titles",
        "create-new-unit",
        "Create New Unit",
      ),
      updateTitle: label(rows, "dialog-titles", "update-unit", "Update Unit"),
      create: label(rows, "button-labels", "create-unit", "Create"),
      update: label(rows, "button-labels", "update-unit", "Update"),
      cancel: label(rows, "button-labels", "cancel", "Cancel"),
      addFund: label(rows, "button-labels", "add-fund", "Add Fund"),
      duplicate: label(
        rows,
        "error-msg",
        "duplicate-fund",
        "This fund has already been added to the application.",
      ),
      saved: label(rows, "success-msg", "saved", "Saved"),
      empty: label(rows, "helper-texts", "no-data", "No data to display."),
    },
    programs: lookupOptions(
      await lookups.codes({ types: LOOKUPS }),
      "FPCG_PROGRAM_TYPE",
    ),
  };
}

const fundTypeRows = z.object({
  items: z.array(
    z.object({
      fund_type_id: z.union([z.number(), z.string()]),
      fund_code: optionalText,
      fund_name: optionalText,
      full_fund_display: optionalText,
    }),
  ),
});
async function fundTypeList(programType: string) {
  return fundTypeRows.parse(await claims.fundTypes({ programType })).items;
}
/** The fund types of a program type (legacy loadFundTypes on the program type's change). */
export async function unitFundTypes(
  programType: string,
): Promise<FundTypeOption[]> {
  const { actions } = await actor();
  requireGate(actions.create || actions.edit);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(programType))
    throw new AppError("BAD_REQUEST", "Unknown program type.", 400);
  return (await fundTypeList(programType)).map((t) => ({
    value: String(t.fund_type_id),
    label: t.full_fund_display || t.fund_name || String(t.fund_type_id),
    code: t.fund_code ?? "",
    name: t.fund_name ?? "",
  }));
}

const grantRows = z.object({
  auto_select: optionalText,
  items: z
    .array(
      z.object({
        grant_value_id: z.union([z.number(), z.string()]),
        grant_display: optionalText,
        payment_account_code: optionalText,
      }),
    )
    .nullish(),
});
async function grantList(fundTypeId: number, fiscalYear: number) {
  return grantRows.parse(await claims.grantValues({ fundTypeId, fiscalYear }));
}
/** A fund type's grants for the dialog's year (legacy loadGrantValues); Payment Account's options come from them too. */
export async function unitGrants(
  fundTypeId: number,
  fiscalYear: number,
): Promise<GrantChoices> {
  const { rows, actions } = await actor();
  requireGate(actions.create || actions.edit);
  const g = dialogGates(rows);
  if (!g.grant.show && !g.account.show)
    return { grants: [], autoSelect: false };
  const b = await grantList(fundTypeId, fiscalYear);
  return {
    grants: (b.items ?? []).map((g) => ({
      value: String(g.grant_value_id),
      label: g.grant_display ?? String(g.grant_value_id),
      paymentAccount: g.payment_account_code ?? "",
    })),
    autoSelect: b.auto_select === "Y",
  };
}

const id = z.coerce.number().int().positive();
const date = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/);
const fundInput = z
  .object({
    /** The saved fund's index in the listing row, or null for a fund added in the dialog. */
    saved: z.number().int().min(0).nullable(),
    fundTypeId: id,
    start: date,
    end: date,
    amendmentDate: date,
    claimDate: date,
    grantId: z.union([id, z.literal("")]),
    paymentAccount: z.string().max(100),
  })
  .strict();
const unitInput = z
  .object({
    appId: id.nullable(),
    unitId: id,
    fiscalYear: z.coerce.number().int().min(1900).max(2200),
    programType: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    funds: z.array(fundInput).max(100),
  })
  .strict();
export type UnitInput = z.infer<typeof unitInput>;

const inside = (value: string, start: string, end: string) =>
  !value || ((!start || value >= start) && (!end || value <= end));

/**
 * WRITES: creates a unit application, or updates one (legacy createNewUnit posts `{...newUnitData, funds}`; `app_id`
 * present updates). Each fund is an explicit pick of legacy's fund type; a saved fund outside DRFT / REWORK goes back
 * exactly as saved, and on an update the unit, year and program type stay the application's own.
 */
export async function saveUnit(raw: unknown) {
  const input = unitInput.parse(raw);
  const { user, rows, actions } = await actor();
  requireGate(input.appId === null ? actions.create : actions.edit);
  const gates = dialogGates(rows);
  const existing =
    input.appId === null
      ? null
      : await visibleUnit(
          user.organizationId,
          input.appId,
          String(input.unitId),
          String(input.fiscalYear),
        );
  const programType = existing?.program_type_code ?? input.programType;
  const [orgs, programs, types] = await Promise.all([
    orgUnitOptions(user.organizationId),
    lookups
      .codes({ types: LOOKUPS })
      .then((c) => lookupOptions(c, "FPCG_PROGRAM_TYPE")),
    fundTypeList(programType),
  ]);
  if (
    !orgs.some((o) => o.value === String(input.unitId)) ||
    !programs.some((p) => p.value === programType)
  )
    throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  const saved = existing?.fund_status ?? [];
  const sent = new Set<number>();
  const grantCache = new Map<number, Promise<z.infer<typeof grantRows>>>();
  const grantsOf = async (fundTypeId: number) => {
    if (!grantCache.has(fundTypeId))
      grantCache.set(fundTypeId, grantList(fundTypeId, input.fiscalYear));
    return (await grantCache.get(fundTypeId)!).items ?? [];
  };
  const funds = [];
  for (const f of input.funds) {
    const before = f.saved === null ? undefined : saved[f.saved];
    if (f.saved !== null) {
      if (!before || sent.has(f.saved))
        throw new AppError(
          "BAD_REQUEST",
          "A fund was not found on the application.",
          400,
        );
      sent.add(f.saved);
      if (before.status && !OPEN_FUND.includes(before.status)) {
        funds.push(fundPayload(before));
        continue;
      }
    }
    const type = types.find(
      (t) => String(t.fund_type_id) === String(f.fundTypeId),
    );
    if (!type)
      throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
    if (
      (f.start && f.end && f.end < f.start) ||
      !inside(f.amendmentDate, f.start, f.end) ||
      !inside(f.claimDate, f.start, f.end)
    )
      throw new AppError(
        "BAD_REQUEST",
        "A fund's dates are out of order.",
        400,
      );
    const offered =
      (gates.grant.show && f.grantId !== "") ||
      (gates.account.show && f.paymentAccount !== "")
        ? await grantsOf(f.fundTypeId)
        : [];
    const grant =
      gates.grant.show && f.grantId !== ""
        ? offered.find((g) => String(g.grant_value_id) === String(f.grantId))
        : undefined;
    if (
      (gates.grant.show && f.grantId !== "" && !grant) ||
      (gates.account.show &&
        f.paymentAccount !== "" &&
        !offered.some((g) => g.payment_account_code === f.paymentAccount))
    )
      throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
    funds.push({
      ...(before ? fundPayload(before) : {}),
      fund_type_id: Number(type.fund_type_id),
      // Legacy saveFund keeps a saved fund's code and names in step with its fund type; an added fund has none.
      ...(before
        ? {
            fund_code: type.fund_code ?? undefined,
            fund_name: type.fund_name ?? undefined,
            full_fund_display: type.full_fund_display ?? undefined,
          }
        : {}),
      grant_period_start: f.start || undefined,
      grant_period_end: f.end || undefined,
      last_date_for_amendment: f.amendmentDate || undefined,
      last_date_for_claim: f.claimDate || undefined,
      ...(gates.grant.show
        ? {
            grant_value_id: grant ? Number(grant.grant_value_id) : undefined,
            grant_display: grant?.grant_display ?? undefined,
          }
        : {}),
      ...(gates.account.show
        ? { payment_account_code: f.paymentAccount || undefined }
        : {}),
    });
  }
  // A locked fund cannot be removed (legacy disables its Delete).
  saved.forEach((f, i) => {
    if (f.status && !OPEN_FUND.includes(f.status) && !sent.has(i))
      throw new AppError(
        "BAD_REQUEST",
        "A submitted fund cannot be removed.",
        400,
      );
  });
  await claims.saveUnit({
    body: {
      ...(input.appId === null ? {} : { app_id: input.appId }),
      unit_id: existing ? Number(existing.unit_id) : input.unitId,
      fy_code: existing ? Number(existing.fiscal_year) : input.fiscalYear,
      program_type_code: programType,
      funds,
    },
  });
  return { saved: true };
}

/** A saved fund exactly as legacy's `newFundDataType` carried it back. */
function fundPayload(f: z.infer<typeof fundRow>) {
  const n = (v: string | number | null | undefined) =>
    v === null || v === undefined || v === "" ? undefined : Number(v);
  return {
    app_fund_id: n(f.app_fund_id),
    full_fund_display: f.full_fund_display ?? undefined,
    fund_code: f.fund_code ?? undefined,
    fund_name: f.fund_name ?? undefined,
    fund_type_id: n(f.fund_type_id),
    grant_period_start: f.grant_period_start ?? undefined,
    grant_period_end: f.grant_period_end ?? undefined,
    last_date_for_amendment: f.last_date_for_amendment ?? undefined,
    last_date_for_claim: f.last_date_for_claim ?? undefined,
    grant_value_id: n(f.grant_value_id),
    grant_display: f.grant_display ?? undefined,
    payment_account_code: f.payment_account_code ?? undefined,
    status: f.status ?? undefined,
    status_value: f.status_value ?? undefined,
  };
}

// ── Clone ───────────────────────────────────────────────────────────────────

const copyRows = z.object({
  items: z.array(
    z.object({
      r: z.string().min(1),
      d: optionalText,
      parent_object: optionalText,
      default_value: z.union([z.boolean(), z.string()]).nullish(),
    }),
  ),
});
async function cloneParts() {
  return copyRows.parse(await claims.copyObjects()).items.map((p) => ({
    value: p.r,
    label: p.d ?? p.r,
    parent: p.parent_object || null,
    fixed: p.default_value === true || p.default_value === "true",
  }));
}

/** Clone's parts tree and texts (legacy cloneUnitBtn reads copy-claim-obj-list on each open). */
export async function unitCloneSetup(): Promise<UnitCloneSetup> {
  const { rows, actions } = await actor();
  requireGate(actions.clone);
  return {
    parts: await cloneParts(),
    texts: {
      title: label(rows, "dialog-titles", "clone-unit", "Clone Unit"),
      year: label(rows, "labels", "clone-fy", "Fiscal Year"),
      entire: label(rows, "option-keys", "entire-unit", "Entire Unit"),
      cancel: label(rows, "button-labels", "cancel", "Cancel"),
      clone: label(rows, "button-labels", "clone", "Clone"),
    },
  };
}

const cloneInput = z
  .object({
    appId: id,
    unitId: id,
    fiscalYear: z.coerce.number().int().min(1900).max(2200),
    toYear: z.coerce.number().int().min(1900).max(2200),
    parts: z.array(z.string().min(1).max(100)).max(100),
  })
  .strict();
/**
 * WRITES: copies a unit application to another fiscal year (legacy prepareClonePayload). Only offered parts are sent.
 * Legacy reports success only when the reply carries the new `app_id`.
 */
export async function cloneUnit(raw: unknown) {
  const input = cloneInput.parse(raw);
  const { user, actions } = await actor();
  requireGate(actions.clone);
  const [, parts] = await Promise.all([
    visibleUnit(
      user.organizationId,
      input.appId,
      String(input.unitId),
      String(input.fiscalYear),
    ),
    cloneParts(),
  ]);
  const offered = new Set(parts.map((p) => p.value));
  if (input.parts.some((p) => !offered.has(p)))
    throw new AppError("BAD_REQUEST", "A chosen part is not offered.", 400);
  const reply = z
    .object({ app_id: numberish })
    .passthrough()
    .safeParse(
      await claims.copy({
        body: {
          app_id: input.appId,
          copy_to_fiscal_year: input.toYear,
          objects: parts
            .filter((p) => input.parts.includes(p.value))
            .map((p) => ({ object_name: p.value, object_val: "true" })),
        },
      }),
    );
  return { cloned: reply.success && Boolean(reply.data.app_id) };
}

// ── Export ──────────────────────────────────────────────────────────────────

/** The listing's report for the drawer's filters (legacy exportReport `report-vbcs-app-unit-listing`). */
export async function exportUnits(filters: UnitFilters) {
  const { user, rows, actions } = await actor();
  requireGate(actions.export);
  const q = unitQuery(filters, listGates(rows));
  return reports.generate({
    body: serverFunctions.reports.reportPayload(
      "report-vbcs-app-unit-listing",
      {
        object_type: "CLAIMS",
        org_id: user.organizationId,
        fund_code: q["fund-code"],
        fund_status: q["fund-status"],
        unit_id: q["unit-id"] || null,
        fy_code: q["fy-code"],
      },
    ),
  });
}

const rowExport = z
  .object({
    appId: id,
    unitId: id,
    fiscalYear: z.coerce.number().int().min(1900).max(2200),
  })
  .strict();
/** One application's consolidated report (legacy row Export `consolidated-grants-application-report`). */
export async function exportUnit(raw: unknown) {
  const parsed = rowExport.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid unit application.", 400);
  const input = parsed.data;
  const { user, actions } = await actor();
  requireGate(actions.export);
  await visibleUnit(
    user.organizationId,
    input.appId,
    String(input.unitId),
    String(input.fiscalYear),
  );
  return reports.generate({
    body: serverFunctions.reports.reportPayload(
      "consolidated-grants-application-report",
      {
        object_type: "CLAIMS",
        org_id: user.organizationId,
        object_id: input.appId,
        fy_code: input.fiscalYear,
        unit_id: input.unitId,
      },
    ),
  });
}
