import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  nameChoices,
  objectDateChoices,
  statusChoices,
} from "@/server/platform/configuration/choices";
import {
  eoiListGates,
  eoiOracleQuery,
  eoiWhereClause,
  gatedFilters,
  mapEoiPage,
} from "@/server/modules/opportunities/eoi";
import {
  DEFAULT_EOI_FILTERS,
  clearedEoiFilters,
  parseEoiFilters,
  serializeEoiFilters,
} from "@/features/modules/opportunities/eoi-list/schema";
import { mergeResourceDefaults } from "@/server/platform/configuration/resources";
import { mockOracle } from "@/test-support/transport";

const f = (change: Partial<typeof DEFAULT_EOI_FILTERS>) => ({
  ...DEFAULT_EOI_FILTERS,
  ...change,
});
const seeds = mergeResourceDefaults([]);
const allGates = eoiListGates(seeds);

it("sends no clause for All with no filters", () => {
  expect(eoiWhereClause(DEFAULT_EOI_FILTERS)).toBeNull();
  expect(eoiOracleQuery(DEFAULT_EOI_FILTERS).has("p_where_clause")).toBe(false);
});

it("builds GN-Angular's clause: order, trimming, quote doubling, day-bounded dates", () => {
  expect(
    eoiWhereClause(
      f({
        title: " Leaders ",
        funder: "Alzheimer's Society",
        createdAfter: "2025-01-01",
        createdBefore: "2025-12-31",
        status: "IA",
      }),
    ),
  ).toBe(
    "(LOWER(\"opp_heading\") LIKE LOWER('%Leaders%') ESCAPE '\\' AND LOWER(\"funders\") LIKE LOWER('%Alzheimer''s Society%') ESCAPE '\\'" +
      " AND \"creation_date\">='2025-01-01 00:00:00' AND \"creation_date\"<='2025-12-31 23:59:59' AND \"status_lkp_code\"='IA')",
  );
});

it.each([
  [
    "number",
    "AOI_5",
    `LOWER("request_number") LIKE LOWER('%AOI\\_5%') ESCAPE '\\'`,
  ],
  [
    "title",
    "O'Brien",
    `LOWER("opp_heading") LIKE LOWER('%O''Brien%') ESCAPE '\\'`,
  ],
  [
    "funder",
    "UKRI (MRC)",
    `LOWER("funders") LIKE LOWER('%UKRI (MRC)%') ESCAPE '\\'`,
  ],
  [
    "department",
    "Physics",
    `LOWER("org_unit_name") LIKE LOWER('%Physics%') ESCAPE '\\'`,
  ],
  ["createdBy", "Ada", `LOWER("full_name") LIKE LOWER('%Ada%') ESCAPE '\\'`],
  ["createdAfter", "2026-02-01", `"creation_date">='2026-02-01 00:00:00'`],
  ["createdBefore", "2026-02-28", `"creation_date"<='2026-02-28 23:59:59'`],
  ["status", "AWARD", `"status_lkp_code"='AWARD'`],
] as const)("filter %s maps to its own column", (key, value, clause) => {
  expect(eoiWhereClause(f({ [key]: value }))).toBe(`(${clause})`);
});

it("blank text filters drop out", () => {
  expect(eoiWhereClause(f({ title: "   ", createdBy: "" }))).toBeNull();
});

it("pages by 10 and sorts only when a Date Sort column is chosen", () => {
  const plain = eoiOracleQuery(f({ offset: 20 }));
  expect(plain.get("p_limit")).toBe("10");
  expect(plain.get("p_offset")).toBe("20");
  expect(plain.has("p_order_by")).toBe(false);
  expect(plain.has("p_sort_order")).toBe(false);
  const sorted = eoiOracleQuery(f({ sortBy: "creation_date" }));
  expect(sorted.get("p_order_by")).toBe('"creation_date"');
  expect(sorted.get("p_sort_order")).toBe("DESC");
  expect(
    eoiOracleQuery(f({ sortBy: "last_update_date", dir: "ascending" })).get(
      "p_sort_order",
    ),
  ).toBe("ASC");
});

it.each([
  "status=IA'OR'1'='1",
  "sortBy=creation_date%22--",
  "createdAfter=2026-1-1",
  "dir=up",
  "offset=-10",
  `title=${"x".repeat(201)}`,
])("rejects unsafe structured filter %s", (qs) =>
  expect(() => parseEoiFilters(new URLSearchParams(qs))).toThrow(),
);

it("round-trips filters and Clear keeps the status", () => {
  const q = f({ status: "IA", funder: "UKRI", sortBy: "creation_date" });
  expect(parseEoiFilters(new URLSearchParams(serializeEoiFilters(q)))).toEqual(
    q,
  );
  expect(serializeEoiFilters(DEFAULT_EOI_FILTERS)).toBe("");
  expect(clearedEoiFilters(q)).toEqual(f({ status: "IA" }));
});

it("a hidden gate drops its filter and its sort (fail closed)", () => {
  const none = Object.fromEntries(
    Object.keys(allGates).map((k) => [k, false]),
  ) as unknown as typeof allGates;
  const q = f({
    status: "IA",
    number: "1",
    title: "t",
    funder: "UKRI",
    department: "d",
    createdBy: "c",
    createdAfter: "2026-01-01",
    createdBefore: "2026-01-02",
    sortBy: "creation_date",
  });
  expect(gatedFilters(q, allGates)).toEqual(q);
  const hidden = gatedFilters(q, none);
  expect(eoiWhereClause(hidden)).toBeNull();
  expect(eoiOracleQuery(hidden).has("p_order_by")).toBe(false);
});

it("gates fail closed when the bundle row is missing or not Y", () => {
  expect(allGates.funder).toBe(true);
  expect(allGates.statusList).toBe(true);
  const hidden = eoiListGates(
    mergeResourceDefaults([
      {
        module_name: "OPPORTUNITIES-EOI",
        label_type: "labels",
        label_name: "eoi-list-sponsor",
        is_visible: "N",
      },
    ]),
  );
  expect(hidden.funder).toBe(false);
  expect(eoiListGates([]).number).toBe(false);
});

it("maps rows to the gated display model with tones, split funders and safe logos", () => {
  const page = mapEoiPage(
    {
      items: [
        {
          request_id: 7,
          request_number: "AOI_7",
          status: "Rejected",
          status_lkp_code: "REJ",
          opp_heading: "Title",
          funders: "Wellcome, UKRI (MRC, EPSRC)",
          full_name: "Ada",
          org_unit_name: "Physics",
          creation_date: "2026-01-01",
          logo: "javascript:alert(1)",
          token: "private",
        },
        {
          request_id: 8,
          request_number: "AOI_8",
          status: "Draft",
          status_lkp_code: "DRFT",
          logo: "https://example.org/l.png",
        },
      ],
      totalcount: "12",
    },
    { ...allGates, department: false },
  );
  expect(page.rows[0]).toEqual({
    id: "7",
    number: "AOI_7",
    status: "Rejected",
    tone: "danger",
    title: "Title",
    funders: ["Wellcome", "UKRI (MRC, EPSRC)"],
    createdBy: "Ada",
    department: undefined,
    created: "2026-01-01",
    updated: undefined,
    logo: undefined,
  });
  expect(page.rows[1].tone).toBeUndefined();
  expect(page.rows[1].logo).toBe("https://example.org/l.png");
  expect(page.total).toBe(12);
  // No ORDS flag: a short page is the last one.
  expect(page.hasMore).toBe(false);
});

it("rejects duplicate requests", () =>
  expect(() =>
    mapEoiPage(
      { items: [{ request_id: 1 }, { request_id: 1 }], totalcount: 2 },
      allGates,
    ),
  ).toThrow(/duplicate/));

it("lists EOI_STATUS with All first and de-duplicates funders", () => {
  expect(
    statusChoices(
      {
        items: [
          {
            lookup_type_code: "EOI_STATUS",
            lookup_code: "IA",
            lookup_code_descr: "Internally Approved",
          },
          { lookup_type_code: "OTHER", lookup_code: "X" },
          { lookup_type_code: "EOI_STATUS", lookup_code: "bad'code" },
        ],
      },
      "EOI_STATUS",
    ),
  ).toEqual([
    { value: "", label: "All" },
    { value: "IA", label: "Internally Approved" },
  ]);
  expect(
    nameChoices(
      {
        items: [{ value: "UKRI" }, { value: "UKRI" }, { value: "Wellcome" }],
      },
      "value",
    ),
  ).toEqual([
    { value: "UKRI", label: "UKRI" },
    { value: "Wellcome", label: "Wellcome" },
  ]);
  expect(
    objectDateChoices({
      items: [
        { column_name: "creation_date", column_description: "Created On" },
        { column_name: 'x" OR 1=1', column_description: "Bad" },
      ],
    }),
  ).toEqual([{ value: "creation_date", label: "Created On" }]);
});

beforeEach(() => {
  vi.stubEnv("FIXTURE_MODE", "true");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());

it("fixture honours the server-built clause, paging and sort", async () => {
  const run = async (q: typeof DEFAULT_EOI_FILTERS) =>
    (await mockOracle(
      "getDynamicFormsAllRequests",
      { p_module_name: "OPPORTUNITIES-EOI" },
      eoiOracleQuery(q),
    )) as {
      items: { status_lkp_code: string; creation_date: string }[];
      totalcount: number;
    };
  const all = await run(DEFAULT_EOI_FILTERS);
  expect(all.items).toHaveLength(10);
  const ia = await run(f({ status: "IA" }));
  expect(ia.totalcount).toBeGreaterThan(0);
  expect(ia.totalcount).toBeLessThan(all.totalcount);
  expect(ia.items.every((r) => r.status_lkp_code === "IA")).toBe(true);
  const asc = await run(f({ sortBy: "creation_date", dir: "ascending" }));
  const dates = asc.items.map((r) => r.creation_date);
  expect(dates).toEqual([...dates].sort());
});
