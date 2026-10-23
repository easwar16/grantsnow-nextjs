import { z } from "zod";

/** The original's fetch size for allRequests (opportunity.service.ts EOI_PAGE_SIZE). */
export const EOI_PAGE_SIZE = 10;

const text = z.string().max(200).default("");
const day = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/)
  .default("");

/**
 * The EOI list's structured filters (GN-Angular EoiFilters + the status list + the page offset). The browser sends
 * only these; the server turns them into SQL. `status` '' is All; `sortBy` '' means no sort.
 */
export const eoiFiltersSchema = z.object({
  status: z
    .string()
    .regex(/^[A-Z0-9_]{0,40}$/)
    .default(""),
  number: text,
  title: text,
  funder: z.string().max(500).default(""),
  department: text,
  createdBy: text,
  createdAfter: day,
  createdBefore: day,
  sortBy: z
    .string()
    .regex(/^([A-Za-z][A-Za-z0-9_]{0,62})?$/)
    .default(""),
  dir: z.enum(["ascending", "descending"]).default("descending"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type EoiFilters = z.infer<typeof eoiFiltersSchema>;

export const DEFAULT_EOI_FILTERS: EoiFilters = eoiFiltersSchema.parse({});

/** Query string for the list route: only values that differ from the defaults. */
export function serializeEoiFilters(f: EoiFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f))
    if (value !== DEFAULT_EOI_FILTERS[key as keyof EoiFilters])
      params.set(key, String(value));
  return params.toString();
}

export function parseEoiFilters(params: URLSearchParams) {
  return eoiFiltersSchema.parse(Object.fromEntries(params));
}

/** Clear resets the drawer filters and sort, not the status list or the paging (as the original). */
export const clearedEoiFilters = (f: EoiFilters): EoiFilters => ({
  ...DEFAULT_EOI_FILTERS,
  status: f.status,
});
