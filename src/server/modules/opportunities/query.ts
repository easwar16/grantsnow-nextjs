import "server-only";
import { containsClause } from "@/server/oracle/where";
import type { OpportunityQuery } from "@/features/modules/opportunities/schemas";
import {
  PAGE_SIZE,
  type DateFilter,
  type FinderFilters,
  type FinderTab,
} from "@/features/modules/opportunities/finder/state";
/**
 * The finder's `p_where_clause` for getOpportunities: GN-Angular where-clause.ts (VBCS `filterCriterion`,
 * `buildKeywordCriteria` and transforms.js `prepareQuery`). Built only here, from validated structured filters:
 * the browser never sends SQL, columns come from this allowlist and every value is quote-escaped.
 */
const COLUMNS = [
  "preference",
  "is_bookmarked",
  "shared_with_me",
  "opp_heading",
  "publication_date",
  "opening_date",
  "closing_date",
  "opportunity_status",
  "funding_type",
  "funder_type",
  "total_fund",
  "call",
  "aln_number",
  "funding_opportunity_number",
  "cost_sharing_requirement",
  "funders",
  "co_funders",
  "site",
] as const;
type Column = (typeof COLUMNS)[number];
const DATE_COLUMNS: Column[] = [
  "publication_date",
  "opening_date",
  "closing_date",
];
export type Criterion =
  | {
      op: "$eq" | "$co" | "$ge" | "$le";
      attribute: Column;
      value: string | number | null | undefined;
    }
  | { op: "$null" | "$notnull"; attribute: Column }
  | { op: "$and" | "$or"; criteria: Criterion[] };
const TAB_CLAUSE: Record<FinderTab, Criterion> = {
  featured: { op: "$eq", attribute: "preference", value: "Y" },
  others: { op: "$eq", attribute: "preference", value: "N" },
  bookmarked: { op: "$eq", attribute: "is_bookmarked", value: "Y" },
  shared: { op: "$eq", attribute: "shared_with_me", value: "Y" },
};
/** One partial, case-insensitive match per title word; Match All ANDs the words, Match Any ORs them. */
export function keywordCriteria(
  search: string,
  match: "all" | "any",
): Criterion | null {
  const words = search.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const each: Criterion[] = words.map((word) => ({
    op: "$co",
    attribute: "opp_heading",
    value: word,
  }));
  return each.length === 1
    ? each[0]
    : { op: match === "any" ? "$or" : "$and", criteria: each };
}
function dateCriteria(attribute: Column, d: DateFilter): Criterion[] {
  switch (d.op) {
    case "GT":
      return d.on ? [{ op: "$ge", attribute, value: d.on }] : [];
    case "LT":
      return d.on ? [{ op: "$le", attribute, value: d.on }] : [];
    case "BETWEEN":
      return [
        ...(d.from ? [{ op: "$ge", attribute, value: d.from } as const] : []),
        ...(d.to ? [{ op: "$le", attribute, value: d.to } as const] : []),
      ];
    case "NULL":
      return [{ op: "$null", attribute }];
    case "NOT_NULL":
      return [{ op: "$notnull", attribute }];
  }
}
const anyOf = (
  attribute: Column,
  op: "$eq" | "$co",
  values: string[],
): Criterion[] =>
  values.length
    ? [
        {
          op: "$or",
          criteria: values.map((value) => ({ op, attribute, value })),
        },
      ]
    : [];
const contains = (attribute: Column, value: string): Criterion[] =>
  value.trim() ? [{ op: "$co", attribute, value: value.trim() }] : [];
/**
 * The criteria in the original's order: tab, keyword, the three dates, the value filters, then the funder tree.
 * A whole site matches its `site`; a funder matches `funders` or `co_funders` within its site; selections are ORed.
 */
export function finderCriteria(tab: FinderTab, f: FinderFilters): Criterion[] {
  const keyword = keywordCriteria(f.search, f.match);
  const funders: Criterion[] = f.funders.map((k) =>
    k.funder === null
      ? { op: "$eq", attribute: "site", value: k.site }
      : {
          op: "$and",
          criteria: [
            {
              op: "$or",
              criteria: [
                { op: "$co", attribute: "funders", value: k.funder },
                { op: "$co", attribute: "co_funders", value: k.funder },
              ],
            },
            { op: "$eq", attribute: "site", value: k.site },
          ],
        },
  );
  return [
    TAB_CLAUSE[tab],
    ...(keyword ? [keyword] : []),
    ...dateCriteria("publication_date", f.publication),
    ...dateCriteria("opening_date", f.opening),
    ...dateCriteria("closing_date", f.closing),
    ...anyOf("opportunity_status", "$eq", f.status),
    ...anyOf("funding_type", "$co", f.fundingType),
    ...(f.funderType
      ? [{ op: "$eq", attribute: "funder_type", value: f.funderType } as const]
      : []),
    ...(f.totalFundFrom !== null
      ? [
          {
            op: "$ge",
            attribute: "total_fund",
            value: f.totalFundFrom,
          } as const,
        ]
      : []),
    ...(f.totalFundTo !== null
      ? [{ op: "$le", attribute: "total_fund", value: f.totalFundTo } as const]
      : []),
    ...contains("call", f.call),
    ...contains("aln_number", f.aln),
    ...contains("funding_opportunity_number", f.fon),
    ...contains("cost_sharing_requirement", f.costSharing),
    ...(funders.length ? [{ op: "$or", criteria: funders } as const] : []),
  ];
}
const SYMBOL = { $eq: "=", $ge: ">=", $le: "<=" } as const;
const esc = (v: string | number) => String(v).replace(/'/g, "''");
function clause(c: Criterion): string | null {
  if ("criteria" in c) return whereClause(c.criteria, c.op);
  // The allowlist is enforced at runtime too, so a widened type can never put an unknown column in the SQL.
  if (!COLUMNS.includes(c.attribute)) throw new Error("Unlisted column.");
  const column = `"${c.attribute}"`;
  if (!("value" in c))
    return `${column} IS ${c.op === "$notnull" ? "NOT " : ""}NULL`;
  if (c.value === null || c.value === undefined || c.value === "") return null;
  if (c.op === "$co") return containsClause(column, String(c.value));
  // transforms.js bounds a date to its whole day; only the date columns, so no other value gains a time.
  const value = DATE_COLUMNS.includes(c.attribute)
    ? `${esc(c.value)} ${c.op === "$le" ? "23:59:59" : "00:00:00"}`
    : esc(c.value);
  return `${column}${SYMBOL[c.op]}'${value}'`;
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
/** The getOpportunities request: the clause and page as query params, the sort as headers (as the original). */
export function opportunityOracleQuery(query: OpportunityQuery) {
  const where = whereClause(finderCriteria(query.tab, query.filters));
  return {
    params: new URLSearchParams({
      p_offset: String(query.offset),
      p_limit: String(PAGE_SIZE),
      ...(where ? { p_where_clause: where } : {}),
    }),
    headers: {
      p_order_by: query.filters.orderBy,
      p_sort_order: query.filters.dir === "ascending" ? "ASC" : "DESC",
    },
  };
}
