import "server-only";
import type { OpportunityQuery } from "@/features/opportunities/schemas";
// Existing services/transforms.js emits p_where_clause. Never accept raw SQL,
// column names or operators from the browser; every value is a SQL literal.
function literal(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
function contains(
  column: "opp_heading" | "funders" | "co_funders" | "funding_type",
  value: string,
) {
  return `LOWER("${column}") LIKE LOWER(${literal(`%${value}%`)})`;
}
export function opportunityOracleQuery(query: OpportunityQuery) {
  const parts = [
    query.tab === "bookmarked"
      ? "\"is_bookmarked\"='Y'"
      : query.tab === "shared"
        ? "\"shared_with_me\"='Y'"
        : `"preference"=${literal(query.tab === "others" ? "N" : "Y")}`,
  ];
  const words = query.search.trim().split(/\s+/).filter(Boolean);
  if (words.length)
    parts.push(
      `(${words.map((word) => contains("opp_heading", word)).join(query.match === "any" ? " OR " : " AND ")})`,
    );
  if (query.status)
    parts.push(
      `(${query.status
        .split(",")
        .map((status) => `"opportunity_status"=${literal(status)}`)
        .join(" OR ")})`,
    );
  if (query.funder)
    parts.push(
      `(${contains("funders", query.funder)} OR ${contains("co_funders", query.funder)})`,
    );
  if (query.fundingType)
    parts.push(`"funding_type"=${literal(query.fundingType)}`);
  return new URLSearchParams({
    p_where_clause: `(${parts.join(" AND ")})`,
    p_offset: String((query.page - 1) * query.pageSize),
    p_limit: String(query.pageSize),
  });
}
