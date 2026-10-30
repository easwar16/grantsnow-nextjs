import { z } from "zod";
import { AppError } from "@/lib/errors";
const text = z.string().max(200).default("");
// Lookup codes and employee numbers; values are also quote-escaped server-side.
const code = z
  .string()
  .regex(/^[\w./-]*$/)
  .max(100)
  .default("");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
    );
  })
  .or(z.literal(""))
  .default("");
export const querySchema = z
  .object({
    search: text,
    reference: text,
    status: code,
    faculty: text,
    sponsor: text,
    investigator: code,
    department: z.string().regex(/^\d*$/).max(20).default(""),
    assignedTo: z.string().regex(/^\d*$/).max(20).default(""),
    activityType: code,
    proposalCategory: code,
    tags: text,
    type: z
      .enum([
        "",
        "PROPOSAL",
        "OUTLINE_PROPOSAL",
        "SUB_PROPOSAL",
        "EXTENSION_PROPOSAL",
      ])
      .default(""),
    from: date,
    to: date,
    // A configured date column (getObjectDates PROPOSAL), checked against that list on the server; "" = backend order.
    sort: z
      .string()
      .regex(/^([A-Za-z][A-Za-z0-9_]{0,62})?$/)
      .default(""),
    direction: z.enum(["ASC", "DESC"]).default("DESC"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((n) => [10, 20, 50].includes(n))
      .default(10),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "The date range is reversed.",
  });
export type ProposalQuery = z.infer<typeof querySchema>;
export const proposalModeSchema = z.enum(["view", "edit"]);
export function parseProposalMode(value: string | undefined) {
  return proposalModeSchema.safeParse(value ?? "view");
}
export function parseQuery(params: URLSearchParams): ProposalQuery {
  const result = querySchema.safeParse(Object.fromEntries(params));
  if (!result.success)
    throw new AppError(
      "BAD_REQUEST",
      "One or more listing filters are invalid.",
      400,
    );
  return result.data;
}
export function serializeQuery(q: ProposalQuery) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(q))
    if (
      value !== "" &&
      !(key === "page" && value === 1) &&
      !(key === "pageSize" && value === 10) &&
      !(key === "direction" && value === "DESC")
    )
      p.set(key, String(value));
  return p.toString();
}
