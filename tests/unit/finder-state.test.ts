import { describe, expect, it } from "vitest";
import {
  cleared,
  countStrip,
  DEFAULT_FILTERS,
  entered,
  fromQuery,
  hasUrlFilters,
  MAX_FUNDER_KEYS,
  panelCleared,
  queryString,
  resolveTab,
  toQuery,
} from "@/features/modules/opportunities/finder/state";
import {
  finderRequest,
  parseOpportunityQuery,
  serializeOpportunityQuery,
} from "@/features/modules/opportunities/schemas";
// Port of GN-Angular finder-state.spec.ts, plus the URL and request round-trips.
describe("finder URL sync", () => {
  it("writes the defaults the way VBCS does", () => {
    expect(toQuery(DEFAULT_FILTERS)).toEqual({
      funders: null,
      status: "OPEN,UPCOMING",
      funderType: null,
      fundingType: null,
      orderBy: "publication_date",
      dateDir: "descending",
    });
  });
  it("round-trips sites and funders, commas and all", () => {
    const f = {
      ...DEFAULT_FILTERS,
      funders: [
        { site: "UKRI", funder: null },
        { site: "NIH", funder: "A (B, C)" },
        { site: "X~Y", funder: "100% ~ funded" },
      ],
      fundingType: ["Grant", "Award"],
    };
    expect(fromQuery(toQuery(f), DEFAULT_FILTERS)).toEqual(f);
    // Through the real address too.
    const params = new URLSearchParams(queryString(f));
    expect(fromQuery(Object.fromEntries(params), DEFAULT_FILTERS)).toEqual(f);
  });
  it("keeps filters the link does not mention, and ignores a bad sort or direction", () => {
    const base = { ...DEFAULT_FILTERS, search: "heart", status: ["CLOSED"] };
    expect(
      fromQuery(
        { funderType: "Charity", dateDir: "sideways", orderBy: "token" },
        base,
      ),
    ).toEqual({ ...base, funderType: "Charity" });
    expect(fromQuery({ orderBy: "closing_soon" }, base).orderBy).toBe(
      "closing_soon",
    );
  });
  it("caps a link's funders at the panel's limit and survives a bad escape", () => {
    const many = Array.from({ length: 25 }, (_, i) => `S${i}`).join(",");
    expect(fromQuery({ funders: many }, DEFAULT_FILTERS).funders).toHaveLength(
      MAX_FUNDER_KEYS,
    );
    expect(fromQuery({ funders: "A%E0~B" }, DEFAULT_FILTERS).funders).toEqual([
      { site: "A%E0", funder: "B" },
    ]);
  });
  it("only a link with a finder key replaces the remembered filters", () => {
    expect(hasUrlFilters({})).toBe(false);
    expect(hasUrlFilters({ page: "2" })).toBe(false);
    expect(hasUrlFilters({ status: "OPEN" })).toBe(true);
  });
});
describe("clearing and entering", () => {
  const f = {
    ...DEFAULT_FILTERS,
    search: "x",
    match: "any" as const,
    status: ["CLOSED"],
    funders: [{ site: "UKRI", funder: null }],
    call: "C1",
    orderBy: "closing_date" as const,
    dir: "ascending" as const,
  };
  it("the popup's Clear resets filters and search but keeps sort and match mode", () => {
    expect(cleared(f)).toEqual({
      ...DEFAULT_FILTERS,
      match: "any",
      orderBy: "closing_date",
      dir: "ascending",
    });
  });
  it("the panel's Clear keeps the search and match mode only", () => {
    expect(panelCleared(f)).toEqual({
      ...DEFAULT_FILTERS,
      search: "x",
      match: "any",
    });
  });
  it("entering starts search, match and sort over but keeps the filters", () => {
    expect(entered(f)).toEqual({
      ...f,
      search: "",
      match: "all",
      orderBy: "publication_date",
      dir: "descending",
    });
  });
});
describe("tabs and count", () => {
  it("shows Featured only with preferences, defaulting to Others without", () => {
    expect(resolveTab(null, true)).toBe("featured");
    expect(resolveTab(null, false)).toBe("others");
    expect(resolveTab("featured", false)).toBe("others");
    expect(resolveTab("shared", false)).toBe("shared");
  });
  it("reads N of M while more remain, else the total", () => {
    expect(countStrip(25, 4780)).toEqual({ partial: true, text: "25 of 4780" });
    expect(countStrip(29, 29)).toEqual({ partial: false, text: "29" });
    expect(countStrip(0, 0)).toEqual({ partial: false, text: "0" });
  });
});
describe("finder request schema", () => {
  it("round-trips a full request", () => {
    const q = finderRequest({
      tab: "shared",
      offset: 50,
      filters: {
        ...DEFAULT_FILTERS,
        funders: [{ site: "UKRI", funder: "MRC" }],
        closing: { op: "BETWEEN", on: "", from: "2026-01-01", to: "" },
        totalFundFrom: 10,
        orderBy: "closing_soon",
      },
    });
    expect(
      parseOpportunityQuery(new URLSearchParams(serializeOpportunityQuery(q))),
    ).toEqual(q);
  });
  const bad = (patch: object) =>
    new URLSearchParams({
      q: JSON.stringify({ ...finderRequest(), ...patch }),
    });
  const badFilters = (patch: object) =>
    bad({ filters: { ...DEFAULT_FILTERS, ...patch } });
  it.each([
    ["an unknown tab", bad({ tab: "admin" })],
    ["an unaligned offset", bad({ offset: 7 })],
    ["an unknown sort", badFilters({ orderBy: "token" })],
    [
      "an unknown operator",
      badFilters({ closing: { op: "LIKE", on: "", from: "", to: "" } }),
    ],
    [
      "a non-date",
      badFilters({ opening: { op: "GT", on: "1 OR 1=1", from: "", to: "" } }),
    ],
    ["a negative amount", badFilters({ totalFundFrom: -1 })],
    [
      "a 20th funder",
      badFilters({
        funders: Array.from({ length: 20 }, (_, i) => ({
          site: `S${i}`,
          funder: null,
        })),
      }),
    ],
    ["no request", new URLSearchParams("tab=others")],
    ["broken JSON", new URLSearchParams("q=%7B")],
  ])("rejects %s", (_, params) => {
    expect(() => parseOpportunityQuery(params)).toThrow();
  });
});
