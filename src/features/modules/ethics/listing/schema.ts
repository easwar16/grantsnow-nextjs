import { z } from "zod";

const code = z
  .string()
  .regex(/^[A-Z0-9_]{0,40}$/)
  .default("");
const text = z.string().trim().max(200).default("");
const id = z
  .string()
  .regex(/^(\d{1,15})?$/)
  .default("");
const day = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/)
  .default("");

/** VBCS filterEthicsListing, with only the URL fields the listing actually reads. */
export const ethicsFiltersSchema = z.object({
  access: z
    .enum(["EA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"])
    .optional(),
  status: code,
  number: text,
  createdBy: id,
  type: code,
  responseStatus: code,
  formType: code,
  org: id,
  title: text,
  risk: code,
  sort: z
    .string()
    .regex(/^([A-Za-z][A-Za-z0-9_]{0,62})?$/)
    .default(""),
  direction: z.enum(["ascending", "descending"]).default("descending"),
  created: day,
  deadline: day,
  expiry: day,
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type EthicsFilters = z.infer<typeof ethicsFiltersSchema>;
export const defaultEthicsFilters = ethicsFiltersSchema.parse({});
export const parseEthicsFilters = (p: URLSearchParams) =>
  ethicsFiltersSchema.parse(Object.fromEntries(p));
export function serializeEthicsFilters(filters: EthicsFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (
      value !== defaultEthicsFilters[key as keyof EthicsFilters] &&
      value !== undefined
    )
      params.set(key, String(value));
  return params.toString();
}
