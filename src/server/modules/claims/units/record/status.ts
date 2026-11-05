import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { optionalText } from "../listing";

/** Legacy loadStatusConfig's transaction types, read once as the record does. */
const STATUS_TYPES = [
  "CLAIM_ACTIVITY",
  "CLAIM_ADJUSTMENT_HEADER",
  "CLAIM_ADJUSTMENT_LINE",
  "CLAIM_FUNDS",
  "CLAIM_FUNDS_AMENDMENT",
  "CLAIM_HEADER",
  "CLAIM_LINE",
  "CLAIM_ROSTER",
];
const configRow = z.object({
  transaction_type: z.string(),
  status_lookup_code: z.string(),
  allow_user_edit: optionalText,
});
export type StatusConfig = Record<string, Record<string, boolean>>;
/** Legacy loadStatusConfig: per transaction type, the statuses where any row allows a user edit. */
export async function statusConfig(): Promise<StatusConfig> {
  const items = z
    .object({ items: z.array(configRow).nullish() })
    .parse(await claims.statusConfigs({ types: STATUS_TYPES })).items;
  const config: StatusConfig = {};
  for (const r of items ?? []) {
    const type = (config[r.transaction_type] ??= {});
    type[r.status_lookup_code] =
      r.allow_user_edit === "Y" || type[r.status_lookup_code] === true;
  }
  return config;
}
/**
 * Legacy `$application.functions.isAvailable(config, types, status)`: the status is configured for at least one of
 * the types, and none of them forbids a user edit.
 */
export function available(
  config: StatusConfig,
  types: string[],
  status: string | null | undefined,
) {
  if (!status) return false;
  let matched = false;
  for (const type of types) {
    const allowed = config[type]?.[status];
    if (allowed === undefined) continue;
    matched = true;
    if (allowed === false) return false;
  }
  return matched;
}
/** The fund line types most Unit tabs test (legacy 'CLAIM_FUNDS,CLAIM_FUNDS_AMENDMENT'). */
export const FUND_TYPES = ["CLAIM_FUNDS", "CLAIM_FUNDS_AMENDMENT"];
