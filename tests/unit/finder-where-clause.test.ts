import { describe, expect, it } from "vitest";
import {
  finderCriteria,
  keywordCriteria,
  whereClause,
  type Criterion,
} from "@/server/modules/opportunities/query";
import {
  DEFAULT_FILTERS,
  type FinderFilters,
  type FinderTab,
} from "@/features/modules/opportunities/finder/state";
// Port of GN-Angular where-clause.spec.ts.
const where = (patch: Partial<FinderFilters> = {}, tab: FinderTab = "others") =>
  whereClause(finderCriteria(tab, { ...DEFAULT_FILTERS, ...patch }));
describe("finder where clause", () => {
  it("sends the default tab and status exactly as VBCS does", () => {
    expect(where()).toBe(
      `("preference"='N' AND ("opportunity_status"='OPEN' OR "opportunity_status"='UPCOMING'))`,
    );
  });
  it("maps each tab to its column", () => {
    expect(where({ status: [] }, "featured")).toBe(`("preference"='Y')`);
    expect(where({ status: [] }, "bookmarked")).toBe(`("is_bookmarked"='Y')`);
    expect(where({ status: [] }, "shared")).toBe(`("shared_with_me"='Y')`);
  });
  it("matches title words with AND for Match All and OR for Match Any", () => {
    expect(whereClause([keywordCriteria("  heart  study ", "all")!])).toBe(
      `((LOWER("opp_heading") LIKE LOWER('%heart%') ESCAPE '\\' AND LOWER("opp_heading") LIKE LOWER('%study%') ESCAPE '\\'))`,
    );
    expect(whereClause([keywordCriteria("heart study", "any")!])).toBe(
      `((LOWER("opp_heading") LIKE LOWER('%heart%') ESCAPE '\\' OR LOWER("opp_heading") LIKE LOWER('%study%') ESCAPE '\\'))`,
    );
    expect(keywordCriteria("   ", "all")).toBeNull();
  });
  it("escapes quotes in every value, not only funders", () => {
    expect(where({ status: [], search: "Alzheimer's" })).toBe(
      `("preference"='N' AND LOWER("opp_heading") LIKE LOWER('%Alzheimer''s%') ESCAPE '\\')`,
    );
    expect(where({ status: [], call: "O'Brien" })).toContain(
      `LOWER('%O''Brien%')`,
    );
    // A quote can never close the literal early, whatever the field.
    expect(where({ status: ["X') OR ('1'='1"] })).toContain(
      `"opportunity_status"='X'') OR (''1''=''1'`,
    );
    expect(
      where({ status: [], funders: [{ site: "A'B", funder: "C'D" }] }),
    ).toContain(`"site"='A''B'`);
  });
  it("builds site and funder selections as one OR group, last", () => {
    expect(
      where({
        status: [],
        funders: [
          { site: "UKRI", funder: null },
          { site: "NIH", funder: "A (B, C)" },
        ],
      }),
    ).toBe(
      `("preference"='N' AND ("site"='UKRI' OR ((LOWER("funders") LIKE LOWER('%A (B, C)%') ESCAPE '\\' OR LOWER("co_funders") LIKE LOWER('%A (B, C)%') ESCAPE '\\') AND "site"='NIH')))`,
    );
  });
  it("adds the day bounds to dates and handles every operator", () => {
    const base = { status: [] as string[] };
    expect(
      where({
        ...base,
        closing: {
          op: "BETWEEN",
          on: "",
          from: "2026-01-01",
          to: "2026-02-01",
        },
      }),
    ).toBe(
      `("preference"='N' AND "closing_date">='2026-01-01 00:00:00' AND "closing_date"<='2026-02-01 23:59:59')`,
    );
    expect(
      where({
        ...base,
        opening: { op: "GT", on: "2026-03-04", from: "", to: "" },
      }),
    ).toContain(`"opening_date">='2026-03-04 00:00:00'`);
    expect(
      where({
        ...base,
        opening: { op: "LT", on: "2026-03-04", from: "", to: "" },
      }),
    ).toContain(`"opening_date"<='2026-03-04 23:59:59'`);
    expect(
      where({ ...base, publication: { op: "NULL", on: "", from: "", to: "" } }),
    ).toContain(`"publication_date" IS NULL`);
    expect(
      where({
        ...base,
        publication: { op: "NOT_NULL", on: "", from: "", to: "" },
      }),
    ).toContain(`"publication_date" IS NOT NULL`);
    // A BETWEEN with no dates adds nothing.
    expect(where(base)).toBe(`("preference"='N')`);
  });
  it("keeps funding type as a partial match and funder type and fund bounds as exact", () => {
    expect(
      where({
        status: [],
        fundingType: ["Grant"],
        funderType: "Charity",
        totalFundFrom: 1000,
        totalFundTo: 5000,
      }),
    ).toBe(
      `("preference"='N' AND (LOWER("funding_type") LIKE LOWER('%Grant%') ESCAPE '\\') AND "funder_type"='Charity' AND "total_fund">='1000' AND "total_fund"<='5000')`,
    );
  });
  it("gives only date columns a time, so a date-like value elsewhere stays as typed", () => {
    expect(where({ status: [], funderType: "2026-01-01" })).toContain(
      `"funder_type"='2026-01-01'`,
    );
  });
  it("refuses a column outside the allowlist, even past the type system", () => {
    const bad = {
      op: "$eq",
      attribute: "password",
      value: "x",
    } as unknown as Criterion;
    expect(() => whereClause([bad])).toThrow();
  });
});
