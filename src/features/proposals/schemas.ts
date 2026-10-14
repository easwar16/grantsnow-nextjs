import { z } from "zod";
import { AppError } from "@/lib/errors";
const text = z.string().max(200).default("");
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
    status: text,
    faculty: text,
    sponsor: text,
    investigator: text,
    department: z.string().regex(/^\d*$/).max(20).default(""),
    assignedTo: z.string().regex(/^\d*$/).max(20).default(""),
    activityType: text,
    proposalCategory: text,
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
    sort: z
      .enum(["creation_date", "proposal_id", "full_name", "proposal_title"])
      .default("creation_date"),
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
      !(key === "sort" && value === "creation_date") &&
      !(key === "direction" && value === "DESC")
    )
      p.set(key, String(value));
  return p.toString();
}
export function oracleQuery(q: ProposalQuery) {
  const criteria: Record<string, unknown>[] = [];
  for (const [key, attribute] of [
    ["search", "proposal_title"],
    ["reference", "proposal_number"],
    ["faculty", "faculty_name"],
    ["sponsor", "primary_sponsorer"],
  ] as const)
    if (q[key]) criteria.push({ [attribute]: { $instr: q[key] } });
  for (const [key, attribute] of [
    ["status", "proposal_status_code"],
    ["type", "proposal_type"],
    ["investigator", "pi_employee_number"],
  ] as const)
    if (q[key])
      criteria.push({
        [attribute]: {
          $eq:
            key === "investigator" && /^\d+$/.test(q[key])
              ? Number(q[key])
              : q[key],
        },
      });
  for (const [key, attribute] of [
    ["activityType", "activity_type_lkp_code"],
    ["proposalCategory", "proposal_type_lkp_code"],
  ] as const)
    if (q[key]) criteria.push({ [attribute]: { $eq: q[key] } });
  for (const [key, attribute] of [
    ["department", "pi_dept_code"],
    ["assignedTo", "assigned_to"],
  ] as const)
    if (q[key]) criteria.push({ [attribute]: { $eq: Number(q[key]) } });
  const tags = q.tags
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tags.length)
    criteria.push({ $or: tags.map((tag) => ({ tags: { $instr: tag } })) });
  if (q.from)
    criteria.push({
      creation_date: { $gte: { $date: `${q.from}T00:00:00Z` } },
    });
  if (q.to)
    criteria.push({ creation_date: { $lte: { $date: `${q.to}T23:59:59Z` } } });
  return new URLSearchParams({
    q: JSON.stringify({
      ...(criteria.length ? { $and: criteria } : {}),
      $orderby: { [q.sort]: q.direction },
    }),
    p_offset: String((q.page - 1) * q.pageSize),
    p_limit: String(q.pageSize),
  });
}
