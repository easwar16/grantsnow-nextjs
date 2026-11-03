import { z } from "zod";
import { AppError } from "@/lib/errors";

const date = z.union([z.literal(""), z.iso.date()]).default("");
export const contractLevels = [
  ["SUB_PROPOSAL", "Sub Proposal"],
  ["DUE_DILIGENCE", "Due Diligence"],
  ["OPPORTUNITIES-EOI", "Expression Of Interest"],
  ["EXTENSION_PROPOSAL", "Extension Proposal"],
  ["EXTENSION_SUB_PROPOSAL", "Extension Sub Proposal"],
  ["AWARD", "Award"],
  ["PROJECT", "Project"],
  ["ETHICS", "Ethics"],
  ["PROPOSAL", "Proposal"],
  ["OUTLINE_PROPOSAL", "Outline Proposal"],
] as const;
const levelValues = new Set<string>(contractLevels.map(([value]) => value));
export const contractQuery = z
  .object({
    number: z.string().max(100).default(""),
    title: z.string().max(200).default(""),
    referenceNumber: z.string().max(100).default(""),
    contractType: z
      .string()
      .regex(/^[\w./-]*$/)
      .max(100)
      .default(""),
    orgUnit: z.string().regex(/^\d*$/).max(20).default(""),
    status: z
      .string()
      .regex(/^[\w-]*$/)
      .max(50)
      .default(""),
    level: z
      .string()
      .max(250)
      .refine((value) =>
        value === ""
          ? true
          : value.split(",").every((part) => levelValues.has(part)) &&
            new Set(value.split(",")).size === value.split(",").length,
      )
      .default(""),
    from: date,
    to: date,
    sort: z
      .string()
      .regex(/^([A-Za-z][A-Za-z0-9_]{0,62})?$/)
      .default(""),
    direction: z.enum(["ASC", "DESC"]).default("DESC"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to);
export type ContractQuery = z.infer<typeof contractQuery>;
export function parseContractQuery(params: URLSearchParams): ContractQuery {
  const input = Object.fromEntries(params);
  if (params.has("level")) input.level = params.getAll("level").join(",");
  const parsed = contractQuery.safeParse(input);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid contract filters.", 400);
  return parsed.data;
}
export function contractSearch(q: ContractQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q))
    if (
      value !== "" &&
      !(key === "page" && value === 1) &&
      !(key === "direction" && value === "DESC")
    )
      params.set(key, String(value));
  return params.toString();
}
export const contractId = z.string().regex(/^[1-9]\d{0,14}$/);
