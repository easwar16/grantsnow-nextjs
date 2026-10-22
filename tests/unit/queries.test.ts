import { it, expect } from "vitest";
import { parseQuery, serializeQuery } from "@/features/proposals/schemas";
import { oracleQuery } from "@/server/proposals/where-clause";
import { mapProposals } from "@/server/proposals/service";
import { proposals } from "@/test-support/fixtures";
import { moneyDisplay, dateDisplay } from "@/lib/format";
import { homeFilters } from "@/features/home/schemas";
import { mapWidget } from "@/server/home/service";
import { widgets } from "@/server/home/widgets";
const q = parseQuery(new URLSearchParams());
it("round trips URL queries and reset restores defaults", () => {
  const data = parseQuery(
    new URLSearchParams("search=health&type=OUTLINE_PROPOSAL&page=2"),
  );
  expect(parseQuery(new URLSearchParams(serializeQuery(data)))).toEqual(data);
  expect(q.page).toBe(1);
  expect(q.search).toBe("");
});
it.each([
  "page=0",
  "page=-1",
  "pageSize=10000",
  "sort=to ken",
  "direction=DROP",
  "from=2026-02-01&to=2026-01-01",
])("rejects unsafe query %s", (s) =>
  expect(() => parseQuery(new URLSearchParams(s))).toThrow(),
);
it("sends the live initial-load contract: paging only, no where clause or sort", () => {
  expect(oracleQuery(q).toString()).toBe("p_offset=0&p_limit=10");
});
it("matches the live title-filter where clause exactly", () => {
  const p = oracleQuery(parseQuery(new URLSearchParams("search=test")));
  expect(p.get("p_where_clause")).toBe(
    `(LOWER("proposal_title") LIKE LOWER('%test%'))`,
  );
  expect([...p.keys()]).toEqual(["p_where_clause", "p_offset", "p_limit"]);
});
it("builds legacy date bounds, equality, groups and paging in legacy order", () => {
  const p = oracleQuery(
    parseQuery(
      new URLSearchParams(
        "page=3&from=2026-01-01&to=2026-12-31&reference=P_1&status=DRFT&investigator=E1",
      ),
    ),
  );
  expect(p.get("p_where_clause")).toBe(
    `(LOWER("proposal_number") LIKE LOWER('%P_1%') AND "proposal_status_code"='DRFT' AND "creation_date">='2026-01-01 00:00:00' AND "creation_date"<='2026-12-31 23:59:59' AND ("pi_employee_number"='E1'))`,
  );
  expect(p.get("p_offset")).toBe("20");
  expect(p.get("p_limit")).toBe("10");
});
it.each([
  ["search=O'Brien", `(LOWER("proposal_title") LIKE LOWER('%O''Brien%'))`],
  [
    "search=x') OR 1=1 --",
    `(LOWER("proposal_title") LIKE LOWER('%x'') OR 1=1 --%'))`,
  ],
  ["sponsor='", `(LOWER("primary_sponsorer") LIKE LOWER('%''%'))`],
])("escapes quotes so %s stays one literal", (input, clause) =>
  expect(
    oracleQuery(parseQuery(new URLSearchParams(input))).get("p_where_clause"),
  ).toBe(clause),
);
it.each([
  "status=DRFT'--",
  "investigator=1 OR 1=1",
  'activityType=A"',
  "department=1;DROP",
  "assignedTo=x",
  'sort=creation_date" DESC --',
  "sort=1col",
])("rejects unsafe codes, ids and sort columns %s", (s) =>
  expect(() => parseQuery(new URLSearchParams(s))).toThrow(),
);
it("sorts only on a chosen column, quoted as legacy sends it", () => {
  const p = oracleQuery(
    parseQuery(new URLSearchParams("sort=creation_date&direction=ASC")),
  );
  expect(p.get("p_order_by")).toBe('"creation_date"');
  expect(p.get("p_sort_order")).toBe("ASC");
});
it("distinguishes page rows/API total and never uses size as total", () => {
  const page = mapProposals(
    { items: proposals.slice(0, 10), size: 10, total_count: 37, offset: 0 },
    q,
    [],
  );
  expect(page.rows).toHaveLength(10);
  expect(page.total).toBe(37);
  expect(page.hasMore).toBe(true);
  expect(page.rows[0].id).toBe("OUTLINE_PROPOSAL:1000");
});
it("removes configured hidden fields before client serialization", () => {
  const row = mapProposals({ items: [proposals[0]], total_count: 1 }, q, [])
    .rows[0];
  expect(row).not.toHaveProperty("value");
  expect(row).not.toHaveProperty("investigator");
  expect(JSON.stringify(row)).not.toContain("pi_employee_number");
});
it("ignores an unreliable hasMore and trusts total_count", () => {
  const short = mapProposals(
    {
      items: proposals.slice(0, 3),
      hasMore: "true",
      total_count: 13,
      offset: 10,
    },
    { ...q, page: 2 },
    [],
  );
  expect(short.hasMore).toBe(false);
  const mid = mapProposals(
    {
      items: proposals.slice(0, 10),
      hasMore: false,
      total_count: 37,
      offset: 10,
    },
    { ...q, page: 2 },
    [],
  );
  expect(mid.hasMore).toBe(true);
});
it("without total_count, only a full page implies more and no total is invented", () => {
  const full = mapProposals(
    { items: proposals.slice(0, 10), hasMore: false },
    q,
    [],
  );
  expect(full.hasMore).toBe(true);
  expect(full.total).toBeUndefined();
  const partial = mapProposals(
    { items: proposals.slice(0, 2), hasMore: true },
    q,
    [],
  );
  expect(partial.hasMore).toBe(false);
});
it("never treats loaded-so-far size as the total", () => {
  const page = mapProposals({ items: proposals.slice(0, 2), size: 12 }, q, []);
  expect(page.total).toBeUndefined();
});
it("rejects a page for a different offset", () =>
  expect(() =>
    mapProposals({ items: [], total_count: 0, offset: 10 }, q, []),
  ).toThrow());
it("preserves masked money and calendar-date semantics", () => {
  expect(moneyDisplay("****", "GBP")).toBe("****");
  expect(dateDisplay("2026-01-01T23:00:00-08:00")).toBe("01-Jan-2026");
});
it("dashboard accepts verified filters and rejects invalid months", () => {
  expect(homeFilters(new URLSearchParams("year=2026&month=10")).month).toBe(
    "10",
  );
  expect(() => homeFilters(new URLSearchParams("month=13"))).toThrow();
});
it("queue drill-down only passes verified proposal reference", () => {
  const mapped = mapWidget(
    {
      items: [
        { proposal_id: 1, proposal_number: "P_1", proposal_title: "test" },
      ],
    },
    widgets[0],
    { offset: 0 },
  );
  expect(mapped.attention[0].href).toBe("/proposals?reference=P_1");
});
it("statistics refuses malformed values", () =>
  expect(() =>
    mapWidget(
      { items: [{ label: "2026", value: "wrong" }] },
      widgets.find((w) => w.id === "pByYearChart")!,
      { offset: 0 },
    ),
  ).toThrow());
it("maps advanced codes and match-any tags without accepting raw query input", () => {
  const p = oracleQuery(
    parseQuery(
      new URLSearchParams(
        "department=42&assignedTo=17&activityType=RESEARCH&proposalCategory=GRANT&tags=health,climate&q=evil&p_where_clause=evil",
      ),
    ),
  );
  expect(p.get("p_where_clause")).toBe(
    `("pi_dept_code"='42' AND "activity_type_lkp_code"='RESEARCH' AND "proposal_type_lkp_code"='GRANT' AND ("assigned_to"='17') AND (LOWER("tags") LIKE LOWER('%health%') OR LOWER("tags") LIKE LOWER('%climate%')))`,
  );
  expect(p.toString()).not.toContain("evil");
  expect(p.has("q")).toBe(false);
});
it("rejects calendar-invalid dates", () =>
  expect(() => parseQuery(new URLSearchParams("from=2026-02-31"))).toThrow());
