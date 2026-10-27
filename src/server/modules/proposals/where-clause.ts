import "server-only";
import { containsClause } from "@/server/oracle/where";
import type { ProposalQuery } from "@/features/modules/proposals/schemas";
/**
 * The getProposalsList query: legacy `fetchFilterCriteria` (proposals-start-page.js) through the `apiList`
 * branch of `prepareQuery` / `addQParam` / `paginate` (services/transforms.js), built only on the server.
 * Columns come from this fixed list; every value is a quoted literal with single quotes doubled.
 */
const COLUMNS = [
  "proposal_number",
  "proposal_title",
  "proposal_status_code",
  "faculty_name",
  "pi_dept_code",
  "primary_sponsorer",
  "creation_date",
  "proposal_type",
  "activity_type_lkp_code",
  "proposal_type_lkp_code",
  "pi_employee_number",
  "assigned_to",
  "tags",
] as const;
type Column = (typeof COLUMNS)[number];
type Criterion =
  | { op: "$co" | "$eq" | "$ge" | "$le"; column: Column; value: string }
  | { op: "$and" | "$or"; criteria: Criterion[] };
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
function clause(c: Criterion): string | null {
  if ("criteria" in c) return whereClause(c.criteria, c.op);
  if (!COLUMNS.includes(c.column) || c.value === "") return null;
  const column = `"${c.column}"`;
  if (c.op === "$co") return containsClause(column, c.value);
  // Date bounds are local calendar-day strings, inclusive at both ends.
  if (c.op === "$ge") return `${column}>=${literal(`${c.value} 00:00:00`)}`;
  if (c.op === "$le") return `${column}<=${literal(`${c.value} 23:59:59`)}`;
  return `${column}=${literal(c.value)}`;
}
/** `(a AND b AND (c OR d))`; empty parts drop out, and null when nothing is left. */
export function whereClause(
  criteria: Criterion[],
  op: "$and" | "$or" = "$and",
): string | null {
  const parts = criteria.map(clause).filter((p): p is string => p !== null);
  return parts.length
    ? `(${parts.join(op === "$and" ? " AND " : " OR ")})`
    : null;
}
/** The criteria in legacy order; single-value person filters keep their legacy `$or` group. */
export function proposalCriteria(q: ProposalQuery): Criterion[] {
  const tags = q.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
  return [
    { op: "$co", column: "proposal_number", value: q.reference },
    { op: "$co", column: "proposal_title", value: q.search },
    { op: "$eq", column: "proposal_status_code", value: q.status },
    { op: "$co", column: "faculty_name", value: q.faculty },
    { op: "$eq", column: "pi_dept_code", value: q.department },
    { op: "$co", column: "primary_sponsorer", value: q.sponsor },
    { op: "$ge", column: "creation_date", value: q.from },
    { op: "$le", column: "creation_date", value: q.to },
    { op: "$eq", column: "proposal_type", value: q.type },
    { op: "$eq", column: "activity_type_lkp_code", value: q.activityType },
    { op: "$eq", column: "proposal_type_lkp_code", value: q.proposalCategory },
    {
      op: "$or",
      criteria: [
        { op: "$eq", column: "pi_employee_number", value: q.investigator },
      ],
    },
    {
      op: "$or",
      criteria: [{ op: "$eq", column: "assigned_to", value: q.assignedTo }],
    },
    {
      op: "$or",
      criteria: tags.map((value) => ({ op: "$co", column: "tags", value })),
    },
  ];
}
/**
 * The Oracle query string. `sort` must already be checked against the configured sort columns;
 * no sort sends no `p_order_by`, as the live initial load does.
 */
export function oracleQuery(q: ProposalQuery) {
  const params = new URLSearchParams(),
    where = whereClause(proposalCriteria(q));
  if (where !== null) params.set("p_where_clause", where);
  if (q.sort !== "") {
    params.set("p_order_by", `"${q.sort}"`);
    params.set("p_sort_order", q.direction);
  }
  params.set("p_offset", String((q.page - 1) * q.pageSize));
  params.set("p_limit", String(q.pageSize));
  return params;
}
