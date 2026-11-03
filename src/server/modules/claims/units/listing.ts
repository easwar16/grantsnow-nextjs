import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { claims, lookups } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import type { UnitFilters } from "@/features/modules/claims/units/schema";
import type {
  UnitChoiceList,
  UnitFund,
  UnitListView,
  UnitPage,
  UnitRow,
  UnitTextKey,
} from "@/features/modules/claims/units/types";
import { fiscalYears } from "@/shared/claims/fiscal";
import { constants } from "@/lib/constants";

export const BUNDLE = "claims";
const DRAWER = "claims-unit-inquiry";
export const LOOKUPS = "FPCG_FUND_STATUS,FPCG_FUND_TYPE,FPCG_PROGRAM_TYPE";

export const optionalText = z.string().nullish();
export const numberish = z.union([z.number(), z.string()]).nullish();
const str = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

type Option = { value: string; label: string };
const lookupRow = z.object({
  lookup_type_code: optionalText,
  lookup_code: optionalText,
  lookup_code_value: optionalText,
});
/** One lookup type's codes, labelled with `lookup_code_value` as legacy's selects and status list show them. */
export function lookupOptions(raw: unknown, type: string): Option[] {
  return z
    .object({ items: z.array(lookupRow) })
    .parse(raw)
    .items.flatMap((r) =>
      r.lookup_type_code === type && r.lookup_code
        ? [
            {
              value: r.lookup_code,
              label: r.lookup_code_value || r.lookup_code,
            },
          ]
        : [],
    );
}

export const visible = (rows: Resources, group: string, key: string) =>
  serverFunctions.resources.resourceVisible(rows, BUNDLE, group, key);
export const label = (
  rows: Resources,
  group: string,
  key: string,
  fallback: string,
) => serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);

const TEXTS: Record<UnitTextKey, [string, string, string]> = {
  unit: ["labels", "units-listing-unitId", "Unit"],
  year: ["labels", "units-listing-fiscalYear", "Fiscal Year"],
  fund: ["labels", "units-listing-fundType", "Fund Type"],
  statusLabel: ["aria-labels", "filter-claim-status", "Fund status"],
  fundStatus: ["labels", "units-listing-fund-status", "Fund Status"],
  claimStatus: ["labels", "units-listing-claim-status", "Claim Status"],
  completed: ["labels", "units-listing-claims-completed", "Completed"],
  incomplete: ["labels", "units-listing-claims-incomplete", "Incomplete"],
  inprocess: ["labels", "units-listing-claims-inprocess", "In Process"],
  toggle: ["button-labels", "toggle", "Toggle"],
  create: ["button-labels", "create-new-unit", "Create New Unit"],
  edit: ["button-labels", "listing-edit", "Edit"],
  clone: ["button-labels", "listing-clone", "Clone"],
  export: ["button-labels", "units-listing-export", "Export"],
  exportRow: ["button-labels", "listing-export", "Export"],
  clear: ["button-labels", "clear-filters", "Clear Filters"],
  empty: ["helper-texts", "no-data", "No data to display."],
  total: ["labels", "total-count", "Total"],
};

/** Legacy reads these off `dashboard_access`; a role row with read access opens each. */
function unitActions(
  roles: Parameters<typeof serverFunctions.permissions.pageAccess>[0],
) {
  const can = (page: string) =>
    serverFunctions.permissions.pageAccess(roles, page).read;
  return {
    create: can("create-claims-unit"),
    edit: can("edit-claims-unit"),
    clone: can("claims-clone"),
    export: can("claims-export"),
  };
}

export async function actor() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, DRAWER);
  const [rows, roles] = await Promise.all([resources(), dashboardRoles()]);
  return { user, rows, actions: unitActions(roles) };
}
export function requireGate(open: boolean) {
  if (!open)
    throw new AppError(
      "FORBIDDEN",
      "This action is not enabled for your account.",
      403,
    );
}

/** The drawer filters' RB gates (legacy isVisible === 'Y'). */
export const listGates = (rows: Resources) => ({
  unit: visible(rows, "labels", "units-listing-unitId"),
  year: visible(rows, "labels", "units-listing-fiscalYear"),
  fund: visible(rows, "labels", "units-listing-fundType"),
});

/** Gates, texts, the status list, fund types and years (legacy loadLookups is one read of three types). */
export async function unitListView(): Promise<UnitListView> {
  const { rows, actions } = await actor();
  const gates = listGates(rows);
  const texts = Object.fromEntries(
    Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
      k,
      label(rows, group, key, fallback),
    ]),
  ) as Record<UnitTextKey, string>;
  let codes: unknown = { items: [] };
  const errors: string[] = [];
  try {
    codes = await lookups.codes({ types: LOOKUPS });
  } catch {
    errors.push("Claims lookups could not be loaded.");
  }
  return {
    gates,
    actions,
    texts,
    statuses: [
      { value: "", label: "All" },
      ...lookupOptions(codes, "FPCG_FUND_STATUS"),
    ],
    funds: lookupOptions(codes, "FPCG_FUND_TYPE"),
    years: fiscalYears(),
    errors,
  };
}

const orgRows = z.object({
  items: z.array(
    z.object({
      org_unit_id: z.union([z.number(), z.string()]),
      org_unit_name: optionalText,
    }),
  ),
});
export async function orgUnitOptions(orgId: string): Promise<Option[]> {
  return orgRows.parse(await claims.orgUnits({ orgId })).items.map((o) => ({
    value: String(o.org_unit_id),
    label: o.org_unit_name ?? String(o.org_unit_id),
  }));
}

/** The drawer's and dialog's org units (get-org-units), read once the page shows. */
export async function unitChoices(list: string): Promise<UnitChoiceList> {
  const { user } = await actor();
  if (list !== "orgs")
    throw new AppError("BAD_REQUEST", "Unknown choice list.", 400);
  // Not gated on the filter: the dialog's org unit has no RB gate and reads the same list.
  return serverFunctions.choices.choiceList(
    () => orgUnitOptions(user.organizationId),
    "Org units could not be loaded.",
  );
}

export const fundRow = z.object({
  app_fund_id: numberish,
  full_fund_display: optionalText,
  fund_code: optionalText,
  fund_name: optionalText,
  fund_type_id: numberish,
  grant_period_start: optionalText,
  grant_period_end: optionalText,
  last_date_for_amendment: optionalText,
  last_date_for_claim: optionalText,
  grant_value_id: numberish,
  grant_display: optionalText,
  payment_account_code: optionalText,
  status: optionalText,
  status_value: optionalText,
});
const unitRow = z.object({
  app_id: z.coerce.number().int().positive(),
  unit_id: numberish,
  unit_name: optionalText,
  fiscal_year: numberish,
  program_type_code: optionalText,
  fund_status: z.array(fundRow).nullish(),
  claim_status: z
    .object({
      completed: numberish,
      incomplete: numberish,
      inprocess: numberish,
    })
    .nullish(),
});
const unitPage = z.object({
  items: z.array(unitRow),
  totalResults: z.coerce.number().int().nonnegative().nullish(),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

export function mapFund(f: z.infer<typeof fundRow>): UnitFund {
  return {
    fundTypeId: str(f.fund_type_id),
    name: f.full_fund_display || f.fund_name || "",
    start: day(f.grant_period_start),
    end: day(f.grant_period_end),
    amendmentDate: day(f.last_date_for_amendment),
    claimDate: day(f.last_date_for_claim),
    grantId: str(f.grant_value_id),
    grantName: f.grant_display ?? "",
    paymentAccount: f.payment_account_code ?? "",
    status: f.status ?? "",
    statusName: f.status_value ?? "",
  };
}
export function mapUnitRow(r: z.infer<typeof unitRow>): UnitRow {
  return {
    id: String(r.app_id),
    unitId: str(r.unit_id),
    unitName: r.unit_name ?? "",
    fiscalYear: str(r.fiscal_year),
    programType: r.program_type_code ?? "",
    funds: (r.fund_status ?? []).map(mapFund),
    claims: {
      completed: str(r.claim_status?.completed),
      incomplete: str(r.claim_status?.incomplete),
      inprocess: str(r.claim_status?.inprocess),
    },
  };
}
export function mapUnitPage(raw: unknown): UnitPage {
  const b = unitPage.parse(raw);
  const rows = b.items.map(mapUnitRow);
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError(
      "CONTRACT",
      "Oracle returned duplicate unit applications.",
    );
  return {
    rows,
    total: b.totalResults ?? null,
    hasMore:
      b.hasMore === undefined
        ? b.items.length >= constants.paging.claims
        : b.hasMore === true || b.hasMore === "true",
  };
}

/** The listing's `uriParams` as legacy getUnitFundsListFetch sends them; hidden filters are not applied. */
export function unitQuery(f: UnitFilters, gates: UnitListView["gates"]) {
  return {
    "fund-code": gates.fund ? f.fund : "",
    "fund-status": f.status,
    "fy-code": gates.year ? f.year : "",
    "unit-id": gates.unit ? f.unit : "",
    offset: String(f.offset),
    limit: String(constants.paging.claims),
  };
}

/** One page of unit applications; the session and the drawer grant are checked here. */
export async function listUnits(filters: UnitFilters, signal?: AbortSignal) {
  const { user, rows } = await actor();
  const gates = listGates(rows);
  const raw = await claims.unitList(
    { orgId: user.organizationId, query: unitQuery(filters, gates) },
    { signal },
  );
  return mapUnitPage(raw);
}

/** The unit application as the listing shows it to this user; one the user cannot list does not exist. */
export async function visibleUnit(
  orgId: string,
  appId: number,
  unitId: string,
  year: string,
) {
  const raw = await claims.unitList({
    orgId,
    query: {
      "fund-code": "",
      "fund-status": "",
      "fy-code": year,
      "unit-id": unitId,
      offset: "0",
      limit: String(constants.paging.claims),
    },
  });
  const row = unitPage.parse(raw).items.find((r) => r.app_id === appId);
  if (!row)
    throw new AppError(
      "BAD_REQUEST",
      "The unit application was not found.",
      404,
    );
  return row;
}
