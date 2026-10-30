import { z } from "zod";
import type { IconName } from "@/components/ui/icon";

/** Funds Inquiry's object type: its roles and attachments are keyed by the fund (`app_fund_id`). */
export const FUND_MODULE = "CLAIM_FUNDS";

/** Legacy claims-funds-inquiry-info-page getTabs, in order. */
export const fundTabs = ["summary", "budget", "claims", "attachments"] as const;
export type FundTab = (typeof fundTabs)[number];
export const FUND_TAB_DEFS: Record<
  FundTab,
  { key: string; name: string; icon: IconName }
> = {
  summary: { key: "funds-summary", name: "Summary", icon: "analytics" },
  budget: { key: "funds-budget", name: "Budget", icon: "money" },
  claims: { key: "funds-claims", name: "Claims", icon: "data-document" },
  attachments: {
    key: "funds-attachments",
    name: "Attachments",
    icon: "attachment",
  },
};
/** The role row (`page_name`) that opens a tab. */
export const pageOf = (tab: FundTab) => `claims-${FUND_TAB_DEFS[tab].key}`;

/**
 * Legacy loadLookups synthesises the status list (not a lookup type): Approved and In Process, sent as the claim
 * lines' `status-type` header.
 */
export const CLAIMS_STATUS = [
  { value: "APPROVED", label: "Approved" },
  { value: "IN-PROCESS", label: "In Process" },
] as const;

const code = z
  .string()
  .regex(/^[A-Za-z0-9_-]{0,40}$/)
  .default("");
/**
 * The record's filter bar (legacy `filters`: function, object, status), carried in the URL from tab to tab as legacy
 * passes them on tab switch. Empty means "the lookup's first code", legacy's default.
 */
export const fundRecordFilters = z.object({
  func: code,
  object: code,
  status: z.enum(["", "APPROVED", "IN-PROCESS"]).default(""),
});
export type FundRecordFilters = z.infer<typeof fundRecordFilters>;
export const parseFundRecordFilters = (
  q: URLSearchParams | Record<string, string | string[] | undefined>,
) => {
  const flat =
    q instanceof URLSearchParams
      ? Object.fromEntries(q)
      : Object.fromEntries(
          Object.entries(q).flatMap(([k, v]) =>
            typeof v === "string" ? [[k, v]] : [],
          ),
        );
  const parsed = fundRecordFilters.safeParse(flat);
  return parsed.success ? parsed.data : fundRecordFilters.parse({});
};
/** Only the set filters, in a stable order, for tab links and the address bar. */
export function serializeFundRecordFilters(f: FundRecordFilters) {
  const q = new URLSearchParams();
  for (const k of ["func", "object", "status"] as const)
    if (f[k] !== "") q.set(k, f[k]);
  return q.toString();
}
