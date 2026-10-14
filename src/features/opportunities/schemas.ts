import { z } from "zod";
import { AppError } from "@/lib/errors";
export const opportunityQuerySchema = z.object({
  tab: z
    .enum(["featured", "others", "bookmarked", "shared"])
    .default("featured"),
  search: z.string().max(200).default(""),
  match: z.enum(["all", "any"]).default("all"),
  status: z
    .string()
    .regex(/^(?:(?:OPEN|UPCOMING|CLOSED)(?:,(?:OPEN|UPCOMING|CLOSED))*)?$/)
    .default("OPEN,UPCOMING"),
  funder: z.string().max(150).default(""),
  fundingType: z.string().max(150).default(""),
  sort: z
    .enum(["publication_date", "opening_date", "closing_date", "opp_heading"])
    .default("publication_date"),
  direction: z.enum(["ASC", "DESC"]).default("DESC"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [25, 50].includes(n))
    .default(25),
});
export type OpportunityQuery = z.infer<typeof opportunityQuerySchema>;
export function parseOpportunityQuery(params: URLSearchParams) {
  const result = opportunityQuerySchema.safeParse(Object.fromEntries(params));
  if (!result.success)
    throw new AppError("BAD_REQUEST", "Invalid opportunity filters.", 400);
  return result.data;
}
export function serializeOpportunityQuery(query: OpportunityQuery) {
  const defaults = opportunityQuerySchema.parse({}),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== defaults[key as keyof OpportunityQuery])
      params.set(key, String(value));
  return params.toString();
}
