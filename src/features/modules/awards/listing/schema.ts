import { z } from "zod";

/** Legacy awards-start list: `scroll-policy-options.fetch-size="10"`. */

const text = z.string().max(200).default("");
const day = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/)
  .default("");
const id = z
  .string()
  .regex(/^(\d{1,15})?$/)
  .default("");

/** Legacy getOperators: the Advanced Query comparisons. */
export const AWARD_OPERATORS = [
  "$eq",
  "$co",
  "$gt",
  "$lt",
  "$ge",
  "$le",
] as const;
export const conditionSchema = z
  .object({
    attribute: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,62}$/),
    op: z.enum(AWARD_OPERATORS),
    value: z.string().trim().min(1).max(200),
  })
  .strict();
export type AwardCondition = z.infer<typeof conditionSchema>;
/** Advanced Query rows travel as one JSON string, so the filters stay one flat, serialisable object. */
const conditions = z
  .string()
  .max(6000)
  .default("")
  .refine((v) => {
    if (v === "") return true;
    try {
      return z.array(conditionSchema).max(20).safeParse(JSON.parse(v)).success;
    } catch {
      return false;
    }
  }, "Invalid Advanced Query.");
export const parseConditions = (v: string): AwardCondition[] =>
  v ? z.array(conditionSchema).parse(JSON.parse(v)) : [];

/**
 * The listing's structured filters (legacy `filterAwardListing` + `dateSort` + the page). The browser sends only these;
 * the server turns them into SQL. `status` '' is All; `sortBy` '' sends no sort, as legacy before a date type is chosen.
 */
export const awardFiltersSchema = z.object({
  status: z
    .string()
    .regex(/^[A-Z0-9_]{0,40}$/)
    .default(""),
  number: text,
  name: text,
  proposal: text,
  org: id,
  assignedTo: id,
  funder: z.string().max(500).default(""),
  billingParty: z.string().max(500).default(""),
  sortBy: z
    .string()
    .regex(/^([A-Za-z][A-Za-z0-9_]{0,62})?$/)
    .default(""),
  dir: z.enum(["ascending", "descending"]).default("descending"),
  start: day,
  end: day,
  /** Principal investigators' person ids, comma-separated. */
  pi: z
    .string()
    .regex(/^(\d{1,15}(,\d{1,15}){0,49})?$/)
    .default(""),
  /** Advanced Query rows (JSON); while any exist the list is read from advanced-search. */
  conditions,
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type AwardFilters = z.infer<typeof awardFiltersSchema>;

export const DEFAULT_AWARD_FILTERS: AwardFilters = awardFiltersSchema.parse({});

/** Query string for the list route: only values that differ from the defaults. */
export function serializeAwardFilters(f: AwardFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f))
    if (value !== DEFAULT_AWARD_FILTERS[key as keyof AwardFilters])
      params.set(key, String(value));
  return params.toString();
}

export function parseAwardFilters(params: URLSearchParams) {
  return awardFiltersSchema.parse(Object.fromEntries(params));
}

/** Legacy ClearFilterButtonActionChain resets the whole filter (status included) and the date sort, not the Advanced Query. */
export const clearedAwardFilters = (f: AwardFilters): AwardFilters => ({
  ...DEFAULT_AWARD_FILTERS,
  conditions: f.conditions,
});

/** The page's URL input (legacy `byStatus`, from Home's charts, with the chart's organisation): only status and org. */
export function awardEntryFilters(params: URLSearchParams): AwardFilters {
  const parsed = awardFiltersSchema
    .pick({ status: true, org: true })
    .safeParse({
      status: params.get("status") ?? undefined,
      org: params.get("org") ?? undefined,
    });
  return parsed.success
    ? { ...DEFAULT_AWARD_FILTERS, ...parsed.data }
    : DEFAULT_AWARD_FILTERS;
}
