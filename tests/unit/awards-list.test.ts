import { expect, it } from "vitest";
import {
  awardListGates,
  awardOracleQuery,
  awardWhereClause,
  gatedAwardFilters,
  conditionClause,
  mapAwardPage,
} from "@/server/modules/awards/listing";
import { awardActionGates } from "@/server/modules/awards/actions";
import { linkedGroups } from "@/server/record/linked/linked";
import { toggleClonePart } from "@/features/modules/awards/listing/actions";
import {
  DEFAULT_AWARD_FILTERS,
  awardEntryFilters,
  parseAwardFilters,
  type AwardFilters,
} from "@/features/modules/awards/listing/schema";
import type { AwardListGates } from "@/features/modules/awards/listing/types";
import { labelBundles } from "@/server/platform/configuration/resources";
import { legacyDeepLink } from "@/shared/auth/legacy-link";
import { serverFunctions } from "@/server/functions";

const f = (change: Partial<AwardFilters>) => ({
  ...DEFAULT_AWARD_FILTERS,
  ...change,
});
const allGates = Object.fromEntries(
  Object.keys(awardListGates([])).map((k) => [k, true]),
) as unknown as AwardListGates;

it("builds the AwardHeader clause in legacy order, escaping text and matching dates on the day", () => {
  expect(
    awardWhereClause(
      f({
        org: "42",
        status: "AIA",
        number: "AW_1",
        proposal: "O'Brien",
        start: "2026-10-01",
        funder: "UKRI",
        assignedTo: "7",
      }),
    ),
  ).toBe(
    `("org_id"='42' AND "award_status_code"='AIA' AND LOWER("award_number") LIKE LOWER('%AW\\_1%') ESCAPE '\\' AND LOWER("proposal_title") LIKE LOWER('%O''Brien%') ESCAPE '\\' AND "award_start_date"='2026-10-01 00:00:00' AND LOWER("sponsor_party_name") LIKE LOWER('%UKRI%') ESCAPE '\\' AND "assigned_to"='7')`,
  );
  expect(awardWhereClause(DEFAULT_AWARD_FILTERS)).toBeNull();
});

it("ORs several principal investigators (legacy sent one '12,34' literal)", () => {
  expect(awardWhereClause(f({ pi: "12" }))).toBe(`("pi_pid"='12')`);
  expect(awardWhereClause(f({ pi: "12,34" }))).toBe(
    `(("pi_pid"='12' OR "pi_pid"='34'))`,
  );
});

it("pages 10 at a time and sorts only once a date type is chosen", () => {
  const plain = awardOracleQuery(f({ offset: 20 }));
  expect([plain.get("p_offset"), plain.get("p_limit")]).toEqual(["20", "10"]);
  expect(plain.has("p_order_by")).toBe(false);
  const sorted = awardOracleQuery(
    f({ sortBy: "creation_date", dir: "ascending" }),
  );
  expect([sorted.get("p_order_by"), sorted.get("p_sort_order")]).toEqual([
    '"creation_date"',
    "ASC",
  ]);
});

it("refuses unsafe filter values before any SQL is built", () => {
  for (const bad of [
    "org=1 OR 1=1",
    "status=A'--",
    "pi=1;DROP",
    "assignedTo=x",
    'sortBy=a"b',
    "start=01-10-2026",
  ])
    expect(() => parseAwardFilters(new URLSearchParams(bad))).toThrow();
});

it("drops a filter whose RB gate is hidden, even from a hand-made request", () => {
  const gates = awardListGates(
    serverFunctions.resources.mergeResourceDefaults([
      {
        module_name: "AWARD",
        label_type: "labels",
        label_name: "list-funder",
        label_value: "Funder",
        is_visible: "N",
      },
    ]),
  );
  // Seeded 'N' on DEV's defaults: Assigned To and Billing Party stay hidden too.
  const g = gatedAwardFilters(
    f({ funder: "UKRI", assignedTo: "7", billingParty: "X", number: "AW" }),
    gates,
  );
  expect([g.funder, g.assignedTo, g.billingParty, g.number]).toEqual([
    "",
    "",
    "",
    "AW",
  ]);
});

it("maps only gated fields, with the legacy title rule and badge tones", () => {
  const raw = {
    total_count: 321,
    hasMore: "true",
    items: [
      {
        award_id: 805,
        proposal_id: 12,
        award_number: "AW_805",
        award_name: "Award name",
        award_status: "Awaiting Internal Approval",
        award_status_code: "AIA",
        proposal_title: "Proposal title",
        award_amount: 400,
        billing_party_name: "Innovate UK",
      },
      { award_id: 806, proposal_id: null, award_name: "Only name" },
    ],
  };
  const page = mapAwardPage(raw, {
    ...allGates,
    name: false,
    billingParty: false,
  });
  expect(page.total).toBe(321);
  expect(page.hasMore).toBe(true);
  expect(page.rows[0]).toMatchObject({
    id: "805",
    title: "Proposal title",
    tone: "warning",
    amount: "400",
  });
  expect(page.rows[0].billingParty).toBeUndefined();
  expect(page.rows[1]).toMatchObject({ title: "Only name" });
  expect(mapAwardPage(raw, allGates).rows[0].title).toBe("Award name");
  expect(() =>
    mapAwardPage({ items: [{ award_id: 1 }, { award_id: 1 }] }, allGates),
  ).toThrow(/duplicate/);
});

it("takes only status and org from the URL, and nothing if either is unsafe", () => {
  expect(
    awardEntryFilters(new URLSearchParams("status=IA&org=202&number=x")),
  ).toEqual(f({ status: "IA", org: "202" }));
  expect(awardEntryFilters(new URLSearchParams("status=x'"))).toEqual(
    DEFAULT_AWARD_FILTERS,
  );
});

it("routes legacy award deep links to the listing or the record placeholder", () => {
  expect(legacyDeepLink("?page=shell&shell=awards")).toBe("/awards");
  expect(
    legacyDeepLink(
      "?award_id=9&proposal_id=12&mode=view&page=shell&shell=awards&awards=awards-detail",
    ),
  ).toBe("/awards/9/header");
  expect(
    legacyDeepLink("?award_id=x&page=shell&shell=awards&awards=awards-detail"),
  ).toBe("/awards");
});

it("asks for the label bundles of the user's modules, as legacy findModuleAccess (AWARDS → AWARD)", () => {
  expect(
    labelBundles({ AWARDS: true, ETHICS: false, "opportunities-group": true }),
  ).toBe("DASHBOARD,AWARD,OPPORTUNITIES-EOI");
  expect(labelBundles({ PROPOSALS: true, OUTLINE_PROPOSAL: true })).toBe(
    "DASHBOARD,PROPOSAL,SUB_PROPOSAL,EXTENSION_PROPOSAL,OUTLINE_PROPOSAL",
  );
  expect(labelBundles({})).toBe("DASHBOARD");
});

it("renders Advanced Query rows as legacy transforms.js, escaped, with dates bounded to their day", () => {
  expect(
    conditionClause({ attribute: "award_name", op: "$co", value: "50%" }),
  ).toBe(`LOWER("award_name") LIKE LOWER('%50\\%%') ESCAPE '\\'`);
  expect(
    conditionClause({ attribute: "amount", op: "$gt", value: "O'1" }),
  ).toBe(`"amount">'O''1'`);
  expect(
    conditionClause({
      attribute: "award_end_date",
      op: "$le",
      value: "2026-12-31",
    }),
  ).toBe(`"award_end_date"<='2026-12-31 23:59:59'`);
});

it("keeps the drawer filters in advanced mode only where the advanced view has the column (legacy pitfall 2)", () => {
  const clause = awardWhereClause(
    f({ proposal: "x", billingParty: "y", assignedTo: "7", number: "AW" }),
    {
      columns: new Set(["proposal_title"]),
      conditions: [{ attribute: "attribute_1", op: "$eq", value: "P1" }],
    },
  );
  expect(clause).toContain(`LOWER("proposal_title")`);
  expect(clause).not.toContain("billing_party_name");
  expect(clause).not.toContain("assigned_to");
  expect(clause).toContain(`"attribute_1"='P1'`);
});

it("ticks clone parts with legacy's parent/child rules, fixed parts always kept", () => {
  const parts = [
    { value: "h", label: "Header", parent: null, fixed: true },
    { value: "p", label: "Projects", parent: null, fixed: false },
    { value: "t", label: "Team", parent: "p", fixed: false },
    { value: "c", label: "Costs", parent: "p", fixed: false },
  ];
  expect(toggleClonePart(parts, ["h"], "p", true)).toEqual([
    "h",
    "p",
    "t",
    "c",
  ]);
  expect(toggleClonePart(parts, ["h"], "t", true)).toEqual(["h", "p", "t"]);
  expect(toggleClonePart(parts, ["h", "p", "t"], "t", false)).toEqual(["h"]);
  expect(toggleClonePart(parts, ["h", "p", "t", "c"], "p", false)).toEqual([
    "h",
  ]);
  expect(toggleClonePart(parts, [], "h", false)).toEqual(["h"]);
});

it("groups linked records in legacy order, leaves the award itself out and maps legacy links in-app", () => {
  const groups = linkedGroups(
    {
      ObjectLinks: [
        { MODULE_NAME: "CONTRACT", OBJECT_ID: 3, OBJECT_NAME: "C_3" },
        {
          MODULE_NAME: "OUTLINE_PROPOSAL",
          OBJECT_ID: 9,
          OBJECT_NAME: "OP_9",
          OBJECT_LINK:
            "https://vbcs.example/?mode=view&proposal_id=9&proposal_type=OUTLINE_PROPOSAL&page=shell&shell=proposals&proposals=proposals-info-start",
        },
        { MODULE_NAME: "AWARD", OBJECT_ID: 5, OBJECT_NAME: "self" },
        { MODULE_NAME: "AWARD", OBJECT_ID: 6, OBJECT_NAME: "AW_6" },
      ],
    },
    { module: "AWARD", id: 5 },
    (_key, fallback) => fallback,
  );
  expect(groups.map((g) => [g.key, g.records.map((r) => r.name)])).toEqual([
    ["parent-proposal", ["OP_9"]],
    ["awards", ["AW_6"]],
    ["contracts", ["C_3"]],
  ]);
  expect(groups[0].records[0].href).toBe("/proposals/OUTLINE_PROPOSAL/9");
  expect(groups[2].records[0].href).toBeUndefined();
  expect(
    linkedGroups({ ObjectLinks: null }, { module: "AWARD", id: 1 }, (k) => k),
  ).toEqual([]);
});

it("needs the award-clone role as well as both clone labels; the rest are RB only", () => {
  const rows = serverFunctions.resources.mergeResourceDefaults([]);
  expect(awardActionGates(rows, [])).toMatchObject({
    create: true,
    link: true,
    clone: false,
    advanced: true,
  });
  expect(
    awardActionGates(rows, [{ page_name: "award-clone", read_access: "Y" }])
      .clone,
  ).toBe(true);
});
