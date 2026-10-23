import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  DATE_OPS,
  DATE_SORTS,
  DEFAULT_FILTERS,
  FINDER_TABS,
  MAX_FUNDER_KEYS,
  PAGE_SIZE,
  type FinderFilters,
} from "./finder/state";
// Values become quote-escaped SQL literals on the server; the schema bounds their size and shape only.
const value = z.string().trim().max(150);
const day = z.union([z.literal(""), z.iso.date()]);
const dateFilter = z.object({
  op: z.enum(DATE_OPS),
  on: day,
  from: day,
  to: day,
});
const amount = z.number().nonnegative().max(1e15).nullable();
const filtersSchema = z.object({
  search: z.string().max(200),
  match: z.enum(["all", "any"]),
  funders: z
    .array(
      z.object({
        site: z.string().min(1).max(200),
        funder: z.string().min(1).max(300).nullable(),
      }),
    )
    .max(MAX_FUNDER_KEYS),
  status: z.array(value.min(1).max(60)).max(20),
  funderType: value.min(1).nullable(),
  fundingType: z.array(value.min(1)).max(50),
  orderBy: z.enum([
    "closing_soon",
    "publication_date",
    "opening_date",
    "closing_date",
  ] satisfies (typeof DATE_SORTS)[number]["code"][]),
  dir: z.enum(["ascending", "descending"]),
  publication: dateFilter,
  opening: dateFilter,
  closing: dateFilter,
  totalFundFrom: amount,
  totalFundTo: amount,
  call: value,
  aln: value,
  fon: value,
  costSharing: value,
});
/** One finder list request: the tab, the whole filter state and the page offset (25 a page, infinite scroll). */
export const finderRequestSchema = z.object({
  tab: z.enum(FINDER_TABS),
  filters: filtersSchema,
  offset: z
    .number()
    .int()
    .min(0)
    .max(250000)
    .refine((n) => n % PAGE_SIZE === 0),
});
export type OpportunityQuery = {
  tab: (typeof FINDER_TABS)[number];
  filters: FinderFilters;
  offset: number;
};
export function finderRequest(
  patch: Partial<OpportunityQuery> = {},
): OpportunityQuery {
  return { tab: "others", filters: DEFAULT_FILTERS, offset: 0, ...patch };
}
/** The API carries the request as one JSON `q` parameter, validated here on both sides. */
export function parseOpportunityQuery(
  params: URLSearchParams,
): OpportunityQuery {
  let raw: unknown;
  try {
    raw = JSON.parse(params.get("q") ?? "");
  } catch {
    raw = undefined;
  }
  const result = finderRequestSchema.safeParse(raw);
  if (!result.success)
    throw new AppError("BAD_REQUEST", "Invalid opportunity filters.", 400);
  return result.data satisfies OpportunityQuery;
}
export function serializeOpportunityQuery(query: OpportunityQuery) {
  return new URLSearchParams({ q: JSON.stringify(query) }).toString();
}
/** The list identity without the offset: a change starts the list over. */
export const listKey = (q: Pick<OpportunityQuery, "tab" | "filters">) =>
  JSON.stringify([q.tab, q.filters]);
