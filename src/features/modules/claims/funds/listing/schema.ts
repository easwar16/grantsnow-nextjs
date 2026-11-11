import { z } from "zod";

const code = z
  .string()
  .regex(/^[A-Za-z0-9_-]{0,40}$/)
  .default("");

/** The Funds Inquiry listing's filters (legacy `fundListFilters` + the page), sent as legacy's `uriParams`. */
export const fundFiltersSchema = z.object({
  unit: z
    .string()
    .regex(/^(\d{1,15})?$/)
    .default(""),
  year: z
    .string()
    .regex(/^(\d{4})?$/)
    .default(""),
  fund: code,
  func: code,
  object: code,
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type FundFilters = z.infer<typeof fundFiltersSchema>;

const KEYS = ["unit", "year", "fund", "func", "object"] as const;
export const clearedFundFilters = (): FundFilters =>
  fundFiltersSchema.parse({});
export const parseFundFilters = (q: URLSearchParams) =>
  fundFiltersSchema.parse(Object.fromEntries(q));
export function serializeFundFilters(f: FundFilters) {
  const q = new URLSearchParams();
  for (const k of KEYS) if (f[k] !== "") q.set(k, f[k]);
  if (f.offset) q.set("offset", String(f.offset));
  return q.toString();
}
/** Legacy disables Clear Filters until one filter is set. */
export const fundFiltered = (f: FundFilters) => KEYS.some((k) => f[k] !== "");
