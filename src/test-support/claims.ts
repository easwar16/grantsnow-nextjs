import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";

/**
 * DEVELOPMENT FIXTURE ONLY: the Claims reads (Unit Inquiry, Funds Inquiry and a fund's record), shaped like the DEV
 * replies of 2026-10-30. 30 unit applications over two org units and two years; each has one fund, the fund ids
 * 7000+. Fund 7001 has the full CLAIM_FUNDS role set; fund 7002 has Summary read N (the record must refuse it).
 */
const UNITS = [
  { org_unit_id: 202, org_unit_name: "Example Research University" },
  { org_unit_id: 203, org_unit_name: "Example School" },
];
const FUND_TYPES = [
  {
    fund_type_id: 1,
    fund_code: "TITLE_I",
    fund_name: "TITLE I",
    full_fund_display: "TITLE I Low Income (84.010A)",
  },
  {
    fund_type_id: 2,
    fund_code: "TITLE_II",
    fund_name: "TITLE II",
    full_fund_display: "TITLE II (84.367A)",
  },
];
const LOOKUPS: Record<string, [string, string][]> = {
  FPCG_FUND_STATUS: [
    ["DRFT", "Original Pending"],
    ["IA", "Original Final Approved"],
  ],
  FPCG_FUND_TYPE: [
    ["TITLE_I", "TITLE I"],
    ["TITLE_II", "TITLE II"],
  ],
  FPCG_PROGRAM_TYPE: [["SCHOOLWIDE", "Schoolwide"]],
  FPCG_FUNCTION_CODE: [
    ["1000", "Instruction"],
    ["2210", "Improvement of Instruction Services"],
  ],
  FPCG_OBJECT_CODE: [
    ["100", "Salaries"],
    ["200", "Employee Benefits"],
  ],
};
const apps = Array.from({ length: 30 }, (_, i) => {
  const unit = UNITS[i % 2];
  const type = FUND_TYPES[i % 2];
  const status =
    i % 3 === 0
      ? ["IA", "Original Final Approved"]
      : ["DRFT", "Original Pending"];
  return {
    app_id: 6000 + i,
    unit_id: unit.org_unit_id,
    unit_name: unit.org_unit_name,
    fiscal_year: 2026 + (i % 2 === 0 ? 1 : 0),
    program_type_code: "SCHOOLWIDE",
    fund_status: [
      {
        app_fund_id: 7000 + i,
        fund_type_id: type.fund_type_id,
        fund_code: type.fund_code,
        fund_name: type.fund_name,
        full_fund_display: type.full_fund_display,
        grant_period_start: "2026-07-01",
        grant_period_end: "2027-06-30",
        last_date_for_amendment: "2027-03-31",
        last_date_for_claim: "2027-06-30",
        grant_value_id: 10 + (i % 2),
        grant_display: `49410${i % 2} - Teacher Quality (FY2027)`,
        payment_account_code: "54320",
        status: status[0],
        status_value: status[1],
      },
    ],
    claim_status: { completed: i % 4, incomplete: 0, inprocess: i % 2 },
  };
});
const page = <T>(rows: T[], query?: URLSearchParams) => {
  const offset = Number(query?.get("offset") ?? 0);
  const limit = Number(query?.get("limit") ?? 25);
  const items = rows.slice(offset, offset + limit);
  return {
    items,
    offset,
    limit,
    count: items.length,
    totalResults: rows.length,
    hasMore: offset + items.length < rows.length ? "true" : "false",
  };
};
/** One fund's lines; Instruction / Salaries carries the approved claims. */
const summary = [
  [1000, "Instruction", 100, "Salaries", 10000, 10000, 0, 6392, 63.92],
  [1000, "Instruction", 200, "Employee Benefits", 22.9, 22.9, 0, 0, 0],
  [
    2210,
    "Improvement of Instruction Services",
    100,
    "Salaries",
    20000,
    20000,
    500,
    0,
    0,
  ],
] as const;
const claimLines = [
  ["1", "October", "2026-07-22T00:00:00Z", "Final Approved", 2950, "1-Driver"],
  ["4", "January", "2026-07-28T00:00:00Z", "Final Approved", 1900, "1-Driver"],
  ["5", "October", "2026-10-05T00:00:00Z", "Final Approved", 90, "Supplies"],
  ["6", "April", "2026-10-05T00:00:00Z", "Final Approved", 1452, "1-Driver"],
] as const;

export function claimsFixture(
  op: string,
  headers: Record<string, string>,
  query?: URLSearchParams,
): unknown {
  if (!fixtureMode())
    throw new Error(
      "Fixture claims cannot run outside explicit development mode.",
    );
  if (
    op === "getPre_awardGetLookupTypesCodes" &&
    query?.get("lookupTypeCode")?.startsWith("FPCG_")
  )
    return {
      items: (query.get("lookupTypeCode") ?? "").split(",").flatMap((type) =>
        (LOOKUPS[type] ?? []).map(([code, value]) => ({
          lookup_type_code: type,
          lookup_code: code,
          lookup_code_value: value,
        })),
      ),
    };
  if (op === "getClaimsOrgUnits") return { items: UNITS };
  if (op === "getUnitFundsList") {
    const f = (k: string) => query?.get(k) ?? "";
    const rows = apps.filter(
      (a) =>
        (!f("unit-id") || String(a.unit_id) === f("unit-id")) &&
        (!f("fy-code") || String(a.fiscal_year) === f("fy-code")) &&
        (!f("fund-status") || a.fund_status[0].status === f("fund-status")) &&
        (!f("fund-code") || a.fund_status[0].fund_code === f("fund-code")),
    );
    return page(rows, query);
  }
  if (op === "getFundTypes") return { items: FUND_TYPES };
  if (op === "getGrantValues") {
    const id = Number(query?.get("fund-type-id"));
    return {
      auto_select: id === 2 ? "Y" : "N",
      items: [
        {
          grant_value_id: 10 + id,
          grant_display: `49410${id} - Teacher Quality (FY${query?.get("fy-code")})`,
          payment_account_code: "54320",
        },
      ],
    };
  }
  if (op === "getCopyClaimObjList")
    return {
      items: [
        {
          r: "funds-clone",
          d: "Application Funds",
          parent_object: null,
          default_value: true,
        },
        {
          r: "unit-goals",
          d: "Goals",
          parent_object: null,
          default_value: false,
        },
        {
          r: "unit-activities",
          d: "Activities",
          parent_object: "unit-goals",
          default_value: false,
        },
        {
          r: "roster",
          d: "Roster",
          parent_object: "unit-activities",
          default_value: false,
        },
      ],
    };
  if (op === "postCopyClaimApp") return { app_id: 6999 };
  if (op === "getFundInquiries") {
    const f = (k: string) => query?.get(k) ?? "";
    const rows = apps
      .filter(
        (a) =>
          (!f("unit-id") || String(a.unit_id) === f("unit-id")) &&
          (!f("fy-code") || String(a.fiscal_year) === f("fy-code")),
      )
      .map((a) => ({
        app_fund_id: a.fund_status[0].app_fund_id,
        app_id: a.app_id,
        unit_id: a.unit_id,
        org_unit_name: a.unit_name,
        fy_code: a.fiscal_year,
        fund_code: a.fund_status[0].fund_code,
        fund_name: a.fund_status[0].fund_name,
        fund_type_id: a.fund_status[0].fund_type_id,
      }));
    return page(rows, query);
  }
  if (op === "getSecurityUser_roles" && headers.p_obj_type === "CLAIM_FUNDS")
    return {
      items: [
        ["claims-funds-summary", headers.p_obj_id === "7002" ? "N" : "Y"],
        ["claims-funds-budget", "Y"],
        ["claims-funds-claims", "Y"],
        ["claims-funds-attachments", "Y"],
        ["claims-export", "Y"],
      ].map(([page_name, read], i) => ({
        page_id: 80 + i,
        page_name,
        component_type: "PAGE",
        read_access: read,
        edit_access: "Y",
        delete_access: "N",
      })),
    };
  if (op === "getAccountSummaries")
    return {
      items: summary.map(
        ([fc, fn, oc, on, original, approved, inProcess, claimed, spent]) => ({
          function_code: fc,
          function_name: fn,
          object_code: oc,
          object_name: on,
          fy_code: 2027,
          original_budget: original,
          approved_budget: approved,
          in_process_claims: inProcess,
          approved_claims: claimed,
          spent_percent: spent,
          available_funds: approved - claimed - inProcess,
        }),
      ),
    };
  if (op === "getActivitiesSummary") {
    const row = summary.find(
      ([fc, , oc]) =>
        String(fc) === query?.get("function-code") &&
        String(oc) === query?.get("object-code"),
    );
    return {
      items: row
        ? [
            {
              activity_number: 1,
              activity_type: "Position",
              status: "Final Approved",
              approved_cost: row[5],
              itemization_text: "Fixture position",
              job_title: "Teacher",
            },
          ]
        : [],
    };
  }
  if (op === "getClaimLinesSummary") {
    const approvedSalaries =
      query?.get("function-code") === "1000" &&
      query?.get("object-code") === "100" &&
      headers["status-type"] === "APPROVED";
    return {
      items: approvedSalaries
        ? claimLines.map(([number, month, date, status, amount, descr]) => ({
            claim_number: number,
            claim_period_month_name: month,
            claim_date: date,
            line_status_descr: status,
            expenditure_amount: amount,
            expenditure_descr: descr,
          }))
        : [],
    };
  }
  return undefined;
}
