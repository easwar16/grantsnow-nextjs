import { it, expect } from "vitest";
import {
  parseQuery,
  serializeQuery,
  oracleQuery,
} from "@/features/proposals/schemas";
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
  "sort=token",
  "direction=DROP",
  "from=2026-02-01&to=2026-01-01",
])("rejects unsafe query %s", (s) =>
  expect(() => parseQuery(new URLSearchParams(s))).toThrow(),
);
it("constructs actual ORDS pagination and inclusive creation dates", () => {
  const p = oracleQuery(
    parseQuery(
      new URLSearchParams("page=3&from=2026-01-01&to=2026-12-31&search=health"),
    ),
  );
  expect(p.get("p_offset")).toBe("20");
  expect(p.get("p_limit")).toBe("10");
  expect(JSON.parse(p.get("q")!).$and).toContainEqual({
    creation_date: { $lte: { $date: "2026-12-31T23:59:59Z" } },
  });
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
it("uses explicit hasMore without inventing totals", () => {
  const page = mapProposals({ items: [], hasMore: false }, q, []);
  expect(page.total).toBeUndefined();
});
it("fails without paging metadata", () =>
  expect(() =>
    mapProposals({ items: proposals.slice(0, 2) }, q, []),
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
it("maps the verified advanced codes and match-any tags without accepting raw ORDS expressions", () => {
  const p = oracleQuery(
    parseQuery(
      new URLSearchParams(
        "department=42&assignedTo=17&activityType=RESEARCH&proposalCategory=GRANT&tags=health,climate&q=evil",
      ),
    ),
  );
  const body = JSON.parse(p.get("q")!);
  expect(body.$and).toContainEqual({ pi_dept_code: { $eq: 42 } });
  expect(body.$and).toContainEqual({ assigned_to: { $eq: 17 } });
  expect(body.$and).toContainEqual({
    $or: [{ tags: { $instr: "health" } }, { tags: { $instr: "climate" } }],
  });
  expect(p.get("q")).not.toContain("evil");
});
it("rejects calendar-invalid dates", () =>
  expect(() => parseQuery(new URLSearchParams("from=2026-02-31"))).toThrow());
