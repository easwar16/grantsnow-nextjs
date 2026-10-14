import { z } from "zod";
import { AppError } from "@/lib/errors";
const list = (pattern: RegExp) => z.string().regex(pattern).optional();
export const homeFiltersSchema = z.object({
  organization: z.string().max(50).optional(),
  year: list(/^\d{4}$/),
  quarter: list(/^[1-4]$/),
  month: list(/^([1-9]|1[0-2])$/),
  offset: z.coerce.number().int().nonnegative().max(100000).default(0),
});
export function homeFilters(params: URLSearchParams) {
  const result = homeFiltersSchema.safeParse(Object.fromEntries(params));
  if (!result.success)
    throw new AppError("BAD_REQUEST", "Invalid dashboard filters.", 400);
  return result.data;
}
