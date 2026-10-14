import { expect, it } from "vitest";
import {
  parseOpportunityQuery,
  serializeOpportunityQuery,
} from "@/features/opportunities/schemas";
import { opportunityOracleQuery } from "@/server/opportunities/query";
import { mapOpportunities } from "@/server/opportunities/service";
const query = parseOpportunityQuery(new URLSearchParams());
it("maps verified Finder filters and pagination with escaped server literals", () => {
  const q = parseOpportunityQuery(
    new URLSearchParams(
      "search=O%27Brien%20health&match=any&page=2&tab=bookmarked",
    ),
  );
  const p = opportunityOracleQuery(q);
  expect(p.get("p_offset")).toBe("25");
  expect(p.get("p_limit")).toBe("25");
  expect(p.get("p_where_clause")).toContain("LOWER('%O''Brien%')");
  expect(p.get("p_where_clause")).toContain("\"is_bookmarked\"='Y'");
  expect(p.get("p_where_clause")).toContain(" OR ");
  expect(
    parseOpportunityQuery(new URLSearchParams(serializeOpportunityQuery(q))),
  ).toEqual(q);
});
it.each([
  "tab=admin",
  "sort=token",
  "status=OPEN%27OR1=1",
  "page=0",
  "pageSize=9999",
])("rejects unallowlisted filter %s", (value) =>
  expect(() => parseOpportunityQuery(new URLSearchParams(value))).toThrow(),
);
const raw = {
  items: [
    {
      opportunities_id: 1,
      opp_heading: "Research",
      opportunity_status: "OPEN",
      opp_heading_link: "javascript:evil()",
      total_fund: 1000,
      publication_date: "2026-01-01",
      aoi_app_count: 20,
      proposal_count: 10,
      outline_proposal_count: 3,
      summary: "<script>evil()</script><p>Details</p>",
      token: "private-data",
    },
  ],
  offset: 0,
  total_count: 50,
  hasMore: "true",
};
it("strips hidden money/counts and untrusted URLs before client serialization", () => {
  const b = mapOpportunities(raw, query, new Set());
  expect(b.total).toBe(50);
  expect(b.hasMore).toBe(true);
  expect(b.rows[0].totalFund).toBeUndefined();
  expect(b.rows[0].applications).toBeUndefined();
  expect(b.rows[0].url).toBeUndefined();
  expect(JSON.stringify(b)).not.toContain("private-data");
});
it("requires both configured visibility and actual count capability", () => {
  const b = mapOpportunities(
    raw,
    query,
    new Set(["aoi-count", "total-fund", "summary"]),
    "GBP",
    new Set(["opportunities-eoi-count"]),
  );
  expect(b.rows[0].applications).toBe(20);
  expect(b.rows[0].totalFund).toBe("1000");
  expect(b.rows[0].currency).toBe("GBP");
  expect(b.rows[0].summary).toBe("<p>Details</p>");
});
it("fails on mismatched pages and duplicate identities", () => {
  expect(() =>
    mapOpportunities({ ...raw, offset: 25 }, query, new Set()),
  ).toThrow();
  expect(() =>
    mapOpportunities(
      { ...raw, items: [raw.items[0], raw.items[0]] },
      query,
      new Set(),
    ),
  ).toThrow();
});
