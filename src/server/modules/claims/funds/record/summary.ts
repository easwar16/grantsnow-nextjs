import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import type { FundSummary } from "@/features/modules/claims/funds/types";
import { label, numberish, optionalText, str } from "../listing";
import { fundRecordRead } from "../record";

const summaryRow = z.object({
  function_code: numberish,
  function_name: optionalText,
  object_code: numberish,
  object_name: optionalText,
  fy_code: numberish,
  original_budget: numberish,
  approved_budget: numberish,
  in_process_claims: numberish,
  approved_claims: numberish,
  spent_percent: numberish,
  available_funds: numberish,
});
export const amount = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const pair = (code?: string | number | null, name?: string | null) =>
  [code, name].filter((p) => p !== null && p !== undefined).join(" - ");

/**
 * A fund's account summary per function and object code (getAccountSummaries), for the listing's Summary dialog and
 * the record's Summary tab. `spent` is a fraction: the backend sends 0–100 (the tab divided, the dialog did not).
 */
export async function accountSummary(
  appFundId: number,
  rows: Resources,
): Promise<FundSummary> {
  const items = z
    .object({ items: z.array(summaryRow) })
    .parse(await claims.accountSummaries({ appFundId })).items;
  const h = (key: string, fallback: string) =>
    label(rows, "table-headers", key, fallback);
  return {
    title: label(rows, "dialog-titles", "summary", "Summary"),
    headers: {
      func: h("fund-function", "Function"),
      object: h("fund-object", "Object"),
      year: h("fund-year", "Year"),
      original: h("fund-original-budget", "Original Budget"),
      approved: h("fund-approved-budget", "Approved Budget"),
      inProcess: h("fund-in-process-claims", "In Process Claims"),
      claimed: h("fund-approved-claims", "Approved Claims"),
      spent: h("fund-spend-percent", "Spent %"),
      available: h("fund-available", "Available Funds"),
    },
    empty: label(rows, "helper-texts", "no-data", "No data to display."),
    rows: items.map((r, i) => {
      const spent = amount(r.spent_percent);
      return {
        key: String(i),
        func: pair(r.function_code, r.function_name),
        object: pair(r.object_code, r.object_name),
        year: str(r.fy_code),
        original: amount(r.original_budget),
        approved: amount(r.approved_budget),
        inProcess: amount(r.in_process_claims),
        claimed: amount(r.approved_claims),
        spent: spent === null ? null : spent / 100,
        available: amount(r.available_funds),
      };
    }),
  };
}

/** The record's Summary tab (legacy claims-funds-summary loadFundSummary). */
export async function summaryView(id: string) {
  const [, rows] = await Promise.all([
    fundRecordRead(id, "summary"),
    resources(),
  ]);
  return accountSummary(Number(id), rows);
}
