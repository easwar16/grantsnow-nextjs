import { expect, it } from "vitest";
import {
  finderRequest,
  parseOpportunityQuery,
  serializeOpportunityQuery,
} from "@/features/modules/opportunities/schemas";
import { DEFAULT_FILTERS } from "@/features/modules/opportunities/finder/state";
import { opportunityOracleQuery } from "@/server/modules/opportunities/query";
import {
  gatedFilters,
  hasPreferences,
  mapOpportunities,
  metaCells,
  opportunityCard,
  uniqueOptions,
} from "@/server/modules/opportunities/service";
import { splitFunders } from "@/features/modules/opportunities/display";
import { idPart } from "@/lib/ids";
const none = () => false;
const only =
  (...keys: string[]) =>
  (key: string) =>
    keys.includes(key);
const query = finderRequest();
it("maps verified Finder filters and pagination with escaped server literals", () => {
  const q = finderRequest({
    tab: "bookmarked",
    offset: 25,
    filters: { ...DEFAULT_FILTERS, search: "O'Brien health", match: "any" },
  });
  const { params, headers } = opportunityOracleQuery(
    parseOpportunityQuery(new URLSearchParams(serializeOpportunityQuery(q))),
  );
  expect(params.get("p_offset")).toBe("25");
  expect(params.get("p_limit")).toBe("25");
  expect(params.get("p_where_clause")).toContain("LOWER('%O''Brien%')");
  expect(params.get("p_where_clause")).toContain("\"is_bookmarked\"='Y'");
  expect(params.get("p_where_clause")).toContain(" OR ");
  expect(headers).toEqual({
    p_order_by: "publication_date",
    p_sort_order: "DESC",
  });
});
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
  const b = mapOpportunities(raw, query, none);
  expect(b.total).toBe(50);
  expect(b.hasMore).toBe(true);
  expect(b.rows[0].meta).toEqual({});
  expect(b.rows[0].applications).toBeUndefined();
  expect(b.rows[0].url).toBeUndefined();
  expect(JSON.stringify(b)).not.toContain("private-data");
});
it("requires both configured visibility and actual count capability", () => {
  const b = mapOpportunities(
    raw,
    query,
    only("aoi-count", "total-fund", "summary"),
    "GBP",
    new Set(["opportunities-eoi-count"]),
  );
  expect(b.rows[0].applications).toBe(20);
  expect(b.rows[0].meta).toEqual({ "total-fund": "1000" });
  expect(b.rows[0].currency).toBe("GBP");
  expect(b.rows[0].summary).toBe("<p>Details</p>");
});
it("fails on mismatched pages and duplicate identities", () => {
  expect(() => mapOpportunities({ ...raw, offset: 25 }, query, none)).toThrow();
  expect(() =>
    mapOpportunities(
      { ...raw, items: [raw.items[0], raw.items[0]] },
      query,
      none,
    ),
  ).toThrow();
});
it("splits funder tags only on commas outside parentheses", () => {
  expect(splitFunders("UKRI (EPSRC, MRC), Wellcome Trust ,")).toEqual([
    "UKRI (EPSRC, MRC)",
    "Wellcome Trust",
  ]);
  expect(splitFunders("A), B")).toEqual(["A)", "B"]);
  expect(splitFunders("")).toEqual([]);
  expect(splitFunders(null)).toEqual([]);
});
it("gates funder tags on the VBCS finder keys and splits them", () => {
  const row = {
    ...raw.items[0],
    funders: "UKRI (EPSRC, MRC),Wellcome",
    co_funders: "NIH",
  };
  const b = mapOpportunities(
    { ...raw, items: [row] },
    query,
    only("funder", "cofunders"),
  );
  expect(b.rows[0].funders).toEqual(["UKRI (EPSRC, MRC)", "Wellcome"]);
  expect(b.rows[0].coFunders).toEqual(["NIH"]);
  expect(
    mapOpportunities({ ...raw, items: [row] }, query, none).rows[0].funders,
  ).toBeUndefined();
});
it("hides counts and flags a degraded state when the access read failed", () => {
  const b = mapOpportunities(raw, query, only("aoi-count"), "GBP", null);
  expect(b.rows[0].applications).toBeUndefined();
  expect(b.countsUnavailable).toBe(true);
  // Nothing to degrade when the bundle hides every count anyway.
  expect(
    mapOpportunities(raw, query, none, "GBP", null).countsUnavailable,
  ).toBeUndefined();
});
it("matches funding type as a contains, as the VBCS filterCriterion", () => {
  const { params } = opportunityOracleQuery(
    finderRequest({ filters: { ...DEFAULT_FILTERS, fundingType: ["Gr'ant"] } }),
  );
  expect(params.get("p_where_clause")).toContain(
    `LOWER("funding_type") LIKE LOWER('%Gr''ant%') ESCAPE '\\'`,
  );
});
it("labels the card from the opener's bundle and gates date columns", () => {
  const rows = [
    {
      module_name: "DASHBOARD",
      label_type: "labels",
      label_name: "total-fund",
      label_value: "Award value",
      is_visible: "Y" as const,
    },
    {
      module_name: "OPPORTUNITIES-EOI",
      label_type: "labels",
      label_name: "publication-date",
      label_value: "Published",
      is_visible: "Y" as const,
    },
    {
      module_name: "OPPORTUNITIES-EOI",
      label_type: "labels",
      label_name: "opening-date",
      label_value: "Opens",
      is_visible: "N" as const,
    },
  ];
  const home = opportunityCard(rows, "dashboard");
  expect(home.labels["total-fund"]).toBe("Award value");
  expect(home.labels["publication-date"]).toBe("Publication Date");
  expect(home.dates).toEqual(["publication-date"]);
  expect(opportunityCard(rows, "finder").labels["publication-date"]).toBe(
    "Published",
  );
});
const eoiRow = (label_name: string, is_visible: "Y" | "N" = "Y") => ({
  module_name: "OPPORTUNITIES-EOI",
  label_type: "labels",
  label_name,
  label_value: null,
  is_visible,
});
it("shows the finder's meta cells behind their RB rows, Shared-only cells on Shared", () => {
  const rows = [
    eoiRow("funding-type"),
    eoiRow("total-fund"),
    eoiRow("award-floor", "N"),
    eoiRow("shared-by"),
  ];
  expect(metaCells(rows, "finder", "others").map((c) => c.key)).toEqual([
    "funding-type",
    "total-fund",
  ]);
  const shared = metaCells(rows, "finder", "shared");
  expect(shared.map((c) => c.key)).toEqual([
    "funding-type",
    "total-fund",
    "shared-by",
  ]);
  expect(shared.find((c) => c.key === "total-fund")?.kind).toBe("money");
  // Home's cells come from the dashboard bundle, and only on an explicit 'Y'.
  expect(metaCells([], "dashboard", "")).toEqual([]);
  const dashboard = ["funding-type", "total-fund", "funder-type"].map(
    (label_name) => ({
      ...eoiRow(label_name, label_name === "total-fund" ? "N" : "Y"),
      module_name: "DASHBOARD",
    }),
  );
  expect(metaCells(dashboard, "dashboard", "").map((c) => c.key)).toEqual([
    "funding-type",
    "funder-type",
  ]);
});
it("sends only gated, non-empty meta values and the deadline list where preferred", () => {
  const row = {
    ...raw.items[0],
    funding_type: "NA",
    high_award_range: 5000,
    programme: " ",
    shared_by: "Alex",
    deadline_date: "2026-11-01, 2026-12-01",
    closing_date: "2026-12-31",
  };
  const show = only(
    "funding-type",
    "fund-ceiling",
    "programme",
    "shared-by",
    "closing-date",
  );
  const page = mapOpportunities({ ...raw, items: [row] }, query, show);
  expect(page.rows[0].meta).toEqual({ "fund-ceiling": "5000" });
  expect(page.rows[0].closing).toBe("2026-11-01, 2026-12-01");
  const home = mapOpportunities(
    { ...raw, items: [row] },
    query,
    show,
    "GBP",
    new Set(),
    false,
  );
  expect(home.rows[0].closing).toBe("2026-12-31");
  const shared = mapOpportunities(
    { ...raw, items: [row] },
    finderRequest({ tab: "shared" }),
    show,
  );
  expect(shared.rows[0].meta?.["shared-by"]).toBe("Alex");
});
it("drops advanced filters whose RB gate is hidden, whatever the browser sent", () => {
  const f = {
    ...DEFAULT_FILTERS,
    aln: "93.1",
    call: "C1",
    totalFundFrom: 5,
    closing: { op: "NULL" as const, on: "", from: "", to: "" },
  };
  const none = gatedFilters([], f);
  expect(none).toMatchObject({ aln: "", call: "", totalFundFrom: null });
  expect(none.closing.op).toBe("BETWEEN");
  const shown = gatedFilters(
    [
      eoiRow("assistance-listing"),
      eoiRow("call-code"),
      eoiRow("closing-date-filter"),
    ],
    f,
  );
  expect(shown).toMatchObject({ aln: "93.1", call: "C1", totalFundFrom: null });
  expect(shown.closing.op).toBe("NULL");
});
it("de-duplicates filter options by value, trimmed, first wins", () => {
  expect(
    uniqueOptions(
      [
        { filter_type: "STATUS", label: "Open", value: "OPEN" },
        { filter_type: "STATUS", label: "Open again", value: " open " },
        { filter_type: "FUNDING_TYPE", label: "Grant", value: "Grant" },
        { filter_type: "STATUS", label: "", value: "  " },
      ],
      "STATUS",
    ),
  ).toEqual([{ label: "Open", value: "OPEN" }]);
});
it("shows Featured only for a non-empty research preference", () => {
  expect(hasPreferences({ items: [] })).toBe(false);
  expect(
    hasPreferences({
      items: [{ research_areas: ",", favourite_funder: null }],
    }),
  ).toBe(false);
  expect(hasPreferences({ items: [{ research_keywords: "Health" }] })).toBe(
    true,
  );
  expect(() => hasPreferences({ error: "x" })).toThrow();
});
it("turns record and config keys into short kebab-case id parts", () => {
  expect(idPart("7400442")).toBe("7400442");
  expect(idPart(3934)).toBe("3934");
  expect(idPart("uk-research")).toBe("uk-research");
  expect(idPart("pPendingApprovals")).toBe("p-pending-approvals");
  expect(idPart("UK Research & Innovation")).toBe("uk-research-innovation");
  expect(idPart("  Charities ")).toBe("charities");
  expect(idPart("")).toBe("none");
});
