import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { claims, lookups } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import { type FundFilters } from "@/features/modules/claims/funds/schema";
import type {
  FundListView,
  FundPage,
  FundTextKey,
} from "@/features/modules/claims/funds/types";
import { fiscalYears } from "@/shared/claims/fiscal";
import { constants } from "@/lib/constants";

const BUNDLE = "claims";
const DRAWER = "claims-funds-inquiry";
const LOOKUPS = "FPCG_FUNCTION_CODE,FPCG_OBJECT_CODE,FPCG_FUND_TYPE";

export const optionalText = z.string().nullish();
export const numberish = z.union([z.number(), z.string()]).nullish();
export const label = (
  rows: Resources,
  group: string,
  key: string,
  fallback: string,
) => serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
const unitGate = (rows: Resources) =>
  serverFunctions.resources.resourceVisible(
    rows,
    BUNDLE,
    "labels",
    "listing-unit-id",
  );

export async function actor() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, DRAWER);
  return { user, rows: await resources() };
}

const lookupRow = z.object({
  lookup_type_code: optionalText,
  lookup_code: optionalText,
  lookup_code_value: optionalText,
});
const codesOf = (raw: unknown, type: string) =>
  z
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

const TEXTS: Record<FundTextKey, [string, string, string]> = {
  unit: ["labels", "listing-unit-id", "Unit"],
  year: ["labels", "listing-fiscal-year", "Fiscal Year"],
  fund: ["labels", "listing-fund", "Fund"],
  func: ["labels", "listing-function", "Function"],
  object: ["labels", "listing-object", "Object"],
  fiscalYear: ["labels", "fiscal-year", "Fiscal Year"],
  fundName: ["labels", "fund-name", "Fund Name"],
  toggle: ["button-labels", "toggle", "Toggle"],
  view: ["button-labels", "view", "View"],
  clear: ["button-labels", "clear-filters", "Clear Filters"],
  empty: ["helper-texts", "no-data", "No data to display."],
  total: ["labels", "total-count", "Total"],
};

/** Gates, texts and the three lookups (legacy loadLookups is one read). */
export async function fundListView(): Promise<FundListView> {
  const { rows } = await actor();
  let codes: unknown = { items: [] };
  const errors: string[] = [];
  try {
    codes = await lookups.codes({ types: LOOKUPS });
  } catch {
    errors.push("Claims lookups could not be loaded.");
  }
  return {
    gates: { unit: unitGate(rows) },
    texts: Object.fromEntries(
      Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
        k,
        label(rows, group, key, fallback),
      ]),
    ) as Record<FundTextKey, string>,
    funds: codesOf(codes, "FPCG_FUND_TYPE"),
    functions: codesOf(codes, "FPCG_FUNCTION_CODE"),
    objects: codesOf(codes, "FPCG_OBJECT_CODE"),
    years: fiscalYears(),
    errors,
  };
}

/** The Unit filter's org units. Legacy declared loadOrgUnits here but never called it, so the filter stayed empty. */
export async function fundChoices(list: string) {
  const { user, rows } = await actor();
  if (list !== "orgs")
    throw new AppError("BAD_REQUEST", "Unknown choice list.", 400);
  return serverFunctions.choices.choiceList(async () => {
    if (!unitGate(rows)) return [];
    return z
      .object({
        items: z.array(
          z.object({
            org_unit_id: z.union([z.number(), z.string()]),
            org_unit_name: optionalText,
          }),
        ),
      })
      .parse(await claims.orgUnits({ orgId: user.organizationId }))
      .items.map((o) => ({
        value: String(o.org_unit_id),
        label: o.org_unit_name ?? String(o.org_unit_id),
      }));
  }, "Org units could not be loaded.");
}

const fundRow = z.object({
  app_fund_id: z.coerce.number().int().positive(),
  unit_id: numberish,
  org_unit_name: optionalText,
  fy_code: numberish,
  fund_name: optionalText,
});
export const fundPage = z.object({
  items: z.array(fundRow),
  totalResults: z.coerce.number().int().nonnegative().nullish(),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});
export const str = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

export function mapFundPage(raw: unknown): FundPage {
  const b = fundPage.parse(raw);
  const rows = b.items.map((r) => ({
    id: String(r.app_fund_id),
    unitName: r.org_unit_name ?? "",
    fiscalYear: str(r.fy_code),
    fundName: r.fund_name ?? "",
  }));
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate funds.");
  return {
    rows,
    total: b.totalResults ?? null,
    hasMore:
      b.hasMore === undefined
        ? b.items.length >= constants.paging.claims
        : b.hasMore === true || b.hasMore === "true",
  };
}

/** Legacy getFundInquiriesFetch's `uriParams`; a hidden Unit filter is not applied. */
export function fundQuery(f: FundFilters, unitShown: boolean, limit: number) {
  return {
    "function-code": f.func,
    "fund-code": f.fund,
    "fy-code": f.year,
    "object-code": f.object,
    "unit-id": unitShown ? f.unit : "",
    offset: String(f.offset),
    limit: String(limit),
  };
}

/** One page of funds; the session and the drawer grant are checked here. */
export async function listFunds(filters: FundFilters, signal?: AbortSignal) {
  const { user, rows } = await actor();
  return mapFundPage(
    await claims.fundList(
      {
        orgId: user.organizationId,
        query: fundQuery(filters, unitGate(rows), constants.paging.claims),
      },
      { signal },
    ),
  );
}
