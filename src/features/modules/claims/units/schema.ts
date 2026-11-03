import { z } from "zod";

const code = z
  .string()
  .regex(/^[A-Za-z0-9_-]{0,40}$/)
  .default("");
const id = z
  .string()
  .regex(/^(\d{1,15})?$/)
  .default("");
const year = z
  .string()
  .regex(/^(\d{4})?$/)
  .default("");

/**
 * The Unit Inquiry listing's filters (legacy `unitListFilters` + the page): fund status ('' is All), org unit,
 * fiscal year and fund type. The server sends them as legacy's `uriParams`.
 */
export const unitFiltersSchema = z.object({
  status: code,
  unit: id,
  year,
  fund: code,
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type UnitFilters = z.infer<typeof unitFiltersSchema>;

const KEYS = ["status", "unit", "year", "fund"] as const;
export const clearedUnitFilters = (): UnitFilters =>
  unitFiltersSchema.parse({});
export const parseUnitFilters = (q: URLSearchParams) =>
  unitFiltersSchema.parse(Object.fromEntries(q));
/** Only the filters that differ from the defaults, in a stable order. */
export function serializeUnitFilters(f: UnitFilters) {
  const q = new URLSearchParams();
  for (const k of KEYS) if (f[k] !== "") q.set(k, f[k]);
  if (f.offset) q.set("offset", String(f.offset));
  return q.toString();
}
/** Legacy disables Clear until one filter is set. */
export const unitFiltered = (f: UnitFilters) => KEYS.some((k) => f[k] !== "");
