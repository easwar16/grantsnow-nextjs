import { expect, it } from "vitest";
import { toggleCloneTree } from "@/components/dialog/clone-parts";
import { mapUnitPage, unitQuery } from "@/server/modules/claims/units/listing";
import { fundQuery, mapFundPage } from "@/server/modules/claims/funds/listing";
import {
  clearedUnitFilters,
  parseUnitFilters,
  serializeUnitFilters,
  unitFiltered,
} from "@/features/modules/claims/units/schema";
import { clearedFundFilters } from "@/features/modules/claims/funds/schema";
import { fiscalYears } from "@/shared/claims/fiscal";
import { legacyDeepLink } from "@/shared/auth/legacy-link";

// The DEV copy-claim-obj-list tree: Goals > Activities > Roster / Surveys; Application Funds fixed.
const parts = [
  { value: "funds", label: "Application Funds", parent: null, fixed: true },
  { value: "goals", label: "Goals", parent: null, fixed: false },
  { value: "acts", label: "Activities", parent: "goals", fixed: false },
  { value: "roster", label: "Roster", parent: "acts", fixed: false },
  { value: "surveys", label: "Surveys", parent: "acts", fixed: false },
];

it("ticks a clone part with every descendant and an ancestor only once all its children are ticked", () => {
  expect(toggleCloneTree(parts, ["funds"], "goals", true)).toEqual([
    "funds",
    "goals",
    "acts",
    "roster",
    "surveys",
  ]);
  // One of two children: the parent stays unticked (claims-unit-inquiry checkboxValueUpdate).
  expect(toggleCloneTree(parts, ["funds"], "roster", true)).toEqual([
    "funds",
    "roster",
  ]);
  expect(toggleCloneTree(parts, ["funds", "roster"], "surveys", true)).toEqual([
    "funds",
    "goals",
    "acts",
    "roster",
    "surveys",
  ]);
});

it("unticks a clone part's descendants, and its ancestors once none of their children remain", () => {
  const all = ["funds", "goals", "acts", "roster", "surveys"];
  expect(toggleCloneTree(parts, all, "roster", false)).toEqual([
    "funds",
    "goals",
    "acts",
    "surveys",
  ]);
  expect(
    toggleCloneTree(
      parts,
      ["funds", "goals", "acts", "surveys"],
      "surveys",
      false,
    ),
  ).toEqual(["funds"]);
  expect(toggleCloneTree(parts, all, "goals", false)).toEqual(["funds"]);
  expect(toggleCloneTree(parts, ["funds"], "funds", false)).toEqual(["funds"]);
});

it("sends the unit filters as legacy's uriParams and drops a filter whose RB gate is hidden", () => {
  const f = {
    ...clearedUnitFilters(),
    status: "DRFT",
    unit: "202",
    year: "2027",
    fund: "TITLE_II",
    offset: 25,
  };
  expect(unitQuery(f, { unit: true, year: true, fund: true })).toEqual({
    "fund-code": "TITLE_II",
    "fund-status": "DRFT",
    "fy-code": "2027",
    "unit-id": "202",
    offset: "25",
    limit: "25",
  });
  expect(unitQuery(f, { unit: false, year: false, fund: false })).toMatchObject(
    {
      "fund-code": "",
      "fy-code": "",
      "unit-id": "",
      "fund-status": "DRFT",
    },
  );
});

it("parses, serialises and clears the unit filters, refusing anything that is not a code", () => {
  const f = parseUnitFilters(
    new URLSearchParams("status=DRFT&year=2027&limit=25"),
  );
  expect(serializeUnitFilters(f)).toBe("status=DRFT&year=2027");
  expect(unitFiltered(f)).toBe(true);
  expect(unitFiltered(clearedUnitFilters())).toBe(false);
  expect(() => parseUnitFilters(new URLSearchParams("status=x'--"))).toThrow();
  expect(() => parseUnitFilters(new URLSearchParams("year=20271"))).toThrow();
});

it("maps a unit-funds-list page: funds with dates as days, claim counts, totals and duplicates refused", () => {
  const page = mapUnitPage({
    items: [
      {
        app_id: 1065,
        unit_id: 13507,
        unit_name: "School of Nursing",
        fiscal_year: 2027,
        program_type_code: "SCHOOLWIDE",
        fund_status: [
          {
            fund_type_id: 2,
            full_fund_display: "TITLE II (84.367A)",
            grant_period_start: "2026-07-01T00:00:00Z",
            grant_value_id: 6,
            grant_display: "494105",
            payment_account_code: "54320",
            status: "DRFT",
            status_value: "Original Pending",
          },
        ],
        claim_status: { completed: 0, incomplete: 2, inprocess: 1 },
      },
    ],
    totalResults: 66,
    hasMore: "true",
  });
  expect(page.total).toBe(66);
  expect(page.hasMore).toBe(true);
  expect(page.rows[0]).toMatchObject({
    id: "1065",
    unitId: "13507",
    fiscalYear: "2027",
    claims: { completed: "0", incomplete: "2", inprocess: "1" },
  });
  expect(page.rows[0].funds[0]).toMatchObject({
    fundTypeId: "2",
    start: "2026-07-01",
    end: "",
    grantId: "6",
    status: "DRFT",
  });
  expect(() => mapUnitPage({ items: [{ app_id: 1 }, { app_id: 1 }] })).toThrow(
    /duplicate/,
  );
});

it("sends the fund filters as legacy's uriParams and maps fund rows", () => {
  const f = {
    ...clearedFundFilters(),
    unit: "202",
    func: "1000",
    object: "100",
  };
  expect(fundQuery(f, true, 25)).toEqual({
    "function-code": "1000",
    "fund-code": "",
    "fy-code": "",
    "object-code": "100",
    "unit-id": "202",
    offset: "0",
    limit: "25",
  });
  expect(fundQuery(f, false, 25)["unit-id"]).toBe("");
  expect(
    mapFundPage({
      items: [
        {
          app_fund_id: 641,
          org_unit_name: "Grants Now dev",
          fy_code: 2029,
          fund_name: "TITLE I",
        },
      ],
    }).rows,
  ).toEqual([
    {
      id: "641",
      unitName: "Grants Now dev",
      fiscalYear: "2029",
      fundName: "TITLE I",
    },
  ]);
});

it("offers legacy's 76 fiscal years from 25 back, and maps legacy claims links in-app", () => {
  const years = fiscalYears(new Date(2026, 9, 30));
  expect(years).toHaveLength(76);
  expect(years[0].value).toBe("2001");
  expect(years.at(-1)?.value).toBe("2076");
  expect(
    legacyDeepLink("?page=shell&shell=claims&claims=claims-funds-inquiry"),
  ).toBe("/claims/funds-inquiry");
});

it("names a downloaded file from Content-Disposition (UTF-8 form first), and keeps a route's error; a body makes it a POST", async () => {
  const { download } = await import("@/lib/api/http");
  const { fileResponse } = await import("@/server/http/response");
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      fileResponse({
        bytes: new Uint8Array([1, 2, 3]),
        mime: "application/pdf",
        filename: "Grants Report – 2027.pdf",
      })) as typeof fetch;
    const ok = await download("/claims/units/export", { appId: "1" });
    expect(ok.ok && ok.data.filename).toBe("Grants Report – 2027.pdf");
    expect(ok.ok && ok.data.blob.size).toBe(3);
    globalThis.fetch = (async () =>
      Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "The unit application was not found.",
          },
        },
        { status: 404 },
      )) as typeof fetch;
    const bad = await download("/claims/units/export", { appId: "9" });
    expect(!bad.ok && bad.error.message).toBe(
      "The unit application was not found.",
    );
    let sent: RequestInit | undefined;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = init;
      return new Response("x", {
        headers: {
          "content-disposition":
            'attachment; filename="Application_Unit_Listing.xlsx"',
        },
      });
    }) as typeof fetch;
    const posted = await download("/claims/units/export", undefined, {
      filters: {},
    });
    expect(posted.ok && posted.data.filename).toBe(
      "Application_Unit_Listing.xlsx",
    );
    expect(sent?.method).toBe("POST");
  } finally {
    globalThis.fetch = real;
  }
});

it("builds legacy's report binds: numbers for ids and years, strings otherwise, blanks kept", async () => {
  const { serverFunctions } = await import("@/server/functions");
  expect(
    serverFunctions.reports.reportPayload("report-vbcs-app-unit-listing", {
      object_type: "CLAIMS",
      org_id: "202",
      fund_code: "",
      unit_id: null,
      fy_code: "2027",
    }),
  ).toEqual({
    report_code: "report-vbcs-app-unit-listing",
    binds: {
      object_type: { type: "VARCHAR2", value: "CLAIMS" },
      org_id: { type: "NUMBER", value: 202 },
      fund_code: { type: "VARCHAR2", value: "" },
      unit_id: { type: "NUMBER", value: null },
      fy_code: { type: "NUMBER", value: 2027 },
    },
  });
});
