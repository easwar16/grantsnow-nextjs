import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";

/**
 * DEVELOPMENT FIXTURE ONLY: the Claims reads (Unit Inquiry, Funds Inquiry and a fund's record), shaped like the DEV
 * replies of 2026-10-30. 30 unit applications over two org units and two years; each has one fund, the fund ids
 * 7000+. Fund 7001 has the full CLAIM_FUNDS role set; fund 7002 has Summary read N (the record must refuse it).
 * Unit record: app 6000 has CLAIMS Summary read and `unit-summary-edit`; app 6001 has Summary read N. Its Summary reads (app-summary,
 * fund-summary, stakeholders, meetings, documents) answer the same rows for any app.
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
  FPCG_ACTIVITY_PERIOD: [
    ["CURRENT", "Current"],
    ["ALL", "All Periods"],
  ],
  FPCG_ACTIVITY_STATUS: [
    ["DRFT", "Draft"],
    ["IA", "Approved"],
  ],
  FPCG_FUND_STATUS: [
    ["DRFT", "Original Pending"],
    ["IA", "Original Final Approved"],
  ],
  FPCG_FUND_TYPE: [
    ["TITLE_I", "TITLE I"],
    ["TITLE_II", "TITLE II"],
  ],
  FPCG_PROGRAM_TYPE: [["SCHOOLWIDE", "Schoolwide"]],
  FPCG_ALLOC_TYPE: [
    ["ORIGINAL", "Original"],
    ["DAY20", "20th Day Adjustment"],
  ],
  FPCG_ALLOC_STATUS: [["PENDING", "Pending"]],
  FPCG_FUNCTION_CODE: [
    ["1000", "Instruction"],
    ["2210", "Improvement of Instruction Services"],
  ],
  FPCG_DOC_TYPE: [["ORG", "Organization Chart"]],
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

/**
 * Fund 7000's allocations, changed by the fixture allocation writes. On globalThis: the route handler and the page
 * can load separate module instances.
 */
type FixtureAllocation = Record<string, unknown> & { alloc_id: number };
const allocationStore = () =>
  ((
    globalThis as { __gnFixtureAllocations?: FixtureAllocation[] }
  ).__gnFixtureAllocations ??= [
    {
      alloc_id: 8000,
      alloc_type_code: "ORIGINAL",
      alloc_status_code: "PENDING",
      alloc_date: "2026-07-01T00:00:00Z",
      amount: 18500,
      app_id: 6000,
      fund_type_id: 1,
    },
  ]);

/** Fund 7000's goals, changed by the fixture goal writes (on globalThis, as the allocations). */
type FixtureGoal = Record<string, unknown> & { app_goal_id: number };
type FixtureActivity = {
  activity_id: number;
  amend_version_id: number;
  app_fund_id: number;
  activity_number: number;
  status_code: string;
  status: string;
  total_amount: number;
  [key: string]: unknown;
};
/** Unit 6000's activities (labelled fixture): one draft, one approved, on TITLE I. */
const activityStore = () =>
  ((
    globalThis as { __gnFixtureActivities?: FixtureActivity[] }
  ).__gnFixtureActivities ??= [
    {
      activity_id: 5100,
      amend_version_id: 1,
      app_fund_id: 7000,
      activity_number: 1,
      function_code: "1000",
      object_code: "100",
      activity_type: "Position",
      ref_goals: "1",
      total_amount: 30000,
      job_title: "Teacher",
      itemization_text: "Reading teacher",
      fte: 1,
      status: "Draft",
      status_code: "DRFT",
      homeless: "N",
      amended: "N",
      function_descr: "Instruction",
      object_descr: "Salaries",
    },
    {
      activity_id: 5101,
      amend_version_id: 2,
      app_fund_id: 7000,
      activity_number: 2,
      function_code: "1000",
      object_code: "400",
      activity_type: "General",
      ref_goals: "1",
      total_amount: 10000,
      itemization_text: "Books",
      status: "Approved",
      status_code: "IA",
      homeless: "Y",
      amended: "N",
      function_descr: "Instruction",
      object_descr: "Supplies",
    },
  ]);
const goalStore = () =>
  ((globalThis as { __gnFixtureGoals?: FixtureGoal[] }).__gnFixtureGoals ??= [
    {
      app_goal_id: 9000,
      app_fund_id: 7000,
      fund_name: "TITLE I",
      fy_code: 2027,
      goal_id: 1,
      goal_number: "1",
      category: "SYSTEM",
      goal_description: "Raise attainment",
      evaluation_text: "On track",
      review_comments: null,
      linked_activities: [
        {
          activity_number: 1,
          activity_status: "Draft",
          itemization_text: "Tutors",
          cost: 1200,
        },
      ],
    },
  ]);

export function claimsFixture(
  op: string,
  headers: Record<string, string>,
  query?: URLSearchParams,
  path?: Record<string, string>,
  body?: unknown,
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
  // Original Pending (DRFT) allows a user edit; Original Final Approved (IA) does not.
  if (op === "getClaimsStatusConfigs")
    return {
      items: [
        ["CLAIM_FUNDS", "DRFT", "Y"],
        ["CLAIM_FUNDS", "IA", "N"],
        ["CLAIM_ACTIVITY", "DRFT", "Y"],
        ["CLAIM_ACTIVITY", "IA", "N"],
        ["CLAIM_FUNDS_AMENDMENT", "ADJ_DRFT", "Y"],
      ].map(([transaction_type, status_lookup_code, allow_user_edit]) => ({
        transaction_type,
        status_lookup_code,
        allow_user_edit,
      })),
    };
  if (op === "getAppFunds")
    return {
      items: [
        [7000, "TITLE I (84.010A)", "DRFT", 1],
        [7001, "TITLE III (84.365A)", "IA", 3],
      ].map(
        ([app_fund_id, full_fund_display, fund_status_code, fund_type_id]) => ({
          app_fund_id,
          full_fund_display,
          fund_status_code,
          fund_type_id,
        }),
      ),
    };
  if (op === "getFundsCategories")
    return {
      items: [
        {
          fund_status_code: path?.app_fund_id === "7001" ? "IA" : "DRFT",
          total_budget: 50000,
          activity_amount: activityStore().reduce(
            (s, a) => s + a.total_amount,
            0,
          ),
          unapplied_balance:
            50000 - activityStore().reduce((s, a) => s + a.total_amount, 0),
          approved_amount: 0,
          categories: [
            {
              category: "Activities",
              pending: activityStore().length,
              review: 0,
              approved: 0,
              rejected: 0,
            },
          ],
        },
      ],
    };
  if (op === "getActivitySummary")
    return {
      items: [
        {
          function_code: "1000",
          function_description: "Instruction",
          obj_100: 30000,
          obj_200: 9000,
          obj_300: null,
          obj_400: 1000,
          obj_500: 0,
          function_total: 40000,
        },
      ],
    };
  if (op === "getActivities")
    return {
      items: activityStore().filter(
        (a) =>
          String(a.app_fund_id) === path?.app_fund_id &&
          (!query?.get("status") || a.status_code === query?.get("status")),
      ),
    };
  if (op === "getClaimsActivity") {
    const a = activityStore().find(
      (x) =>
        String(x.activity_id) === path?.activity_id &&
        String(x.amend_version_id) === path?.amend_version_id,
    );
    return {
      items: a
        ? [
            {
              ...a,
              activity_status: a.status,
              activity_status_code: a.status_code,
              active_version_flag: "Y",
              homeless_flag: a.homeless,
              activity_type_code:
                a.activity_type === "Position" ? "POSITION" : "GENERAL",
              function_code_descr: `${a.function_code} - Instruction`,
              object_code_descr: `${a.object_code} - Object`,
              activity_gen_type: { amount: a.total_amount },
              total_salary_amount: a.total_amount,
              total_benefits_amount: 0,
              total_purchase_service_amount: 0,
              activity_position_type:
                a.activity_type === "Position"
                  ? {
                      fte_code: 1,
                      fte_code_descr: "Full Time",
                      job_title: a.job_title,
                      job_description: "Teaches reading",
                      salary_type_code: "EXEMPT",
                      salary_type_code_descr: "Exempt",
                      total_salary: 30000,
                      salary_percent: 100,
                      benefit_percent: 100,
                      benefits_amount: 3000,
                      activity_cost_items: [
                        {
                          item_id: 1,
                          category_type_code: "BENEFIT",
                          category_code: "FICA",
                          category_code_descr: "FICA",
                          calc_method_code: "SALARY_PERCENT",
                          calc_method_code_descr: "Salary Percent",
                          rate: 10,
                          amount: 3000,
                        },
                      ],
                    }
                  : null,
              goals: [
                {
                  app_goal_id: 9000,
                  goal_id: 1,
                  goal_number: "1",
                  goal_description: "Raise attainment",
                },
              ],
            },
          ]
        : [],
    };
  }
  if (op === "getActivityVersions")
    return {
      items: activityStore()
        .filter((a) => String(a.activity_id) === path?.act_id)
        .map((a) => ({
          amend_version_id: a.amend_version_id,
          version_number: 1,
        })),
    };
  if (op === "getClaimableAmounts")
    return {
      salary_periods: [
        { period: 1, amount: 15000 },
        { period: 2, amount: 15000 },
      ],
      benefit_periods: [],
      purchase_service_periods: [],
    };
  if (op === "getClaimsAmendmentHistory") return { items: [] };
  if (op === "getClaimDetails") return { items: [] };
  if (op === "deleteClaimsActivity") {
    const store = activityStore();
    const i = store.findIndex(
      (a) =>
        String(a.activity_id) === path?.activity_id &&
        String(a.amend_version_id) === path?.amend_version_id,
    );
    if (i >= 0) store.splice(i, 1);
    return { status: "SUCCESS" };
  }
  if (op === "getGoals")
    return {
      items: goalStore().filter(
        (g) => String(g.app_fund_id) === path?.app_fund_id,
      ),
    };
  if (op === "getGoalDetails")
    return {
      items: goalStore().filter(
        (g) => String(g.app_goal_id) === path?.app_goal_id,
      ),
    };
  if (op === "getFundGoals")
    return {
      items: [
        {
          goal_id: 1,
          goal_number: "1",
          goal_description: "Raise attainment",
          category: "SYSTEM",
        },
        {
          goal_id: 3,
          goal_number: "3",
          goal_description: "",
          category: "USER",
        },
      ],
    };
  if (op === "postGoals") {
    const store = goalStore();
    store.push({
      ...(body as Record<string, unknown>),
      app_goal_id: Math.max(9000, ...store.map((g) => g.app_goal_id)) + 1,
      fund_name: "TITLE I",
      linked_activities: [],
    });
    return { status: "SUCCESS" };
  }
  if (op === "putGoals") {
    const store = goalStore();
    const i = store.findIndex(
      (g) => String(g.app_goal_id) === path?.app_goal_id,
    );
    if (i >= 0) store[i] = { ...store[i], ...(body as FixtureGoal) };
    return { status: "SUCCESS" };
  }
  if (op === "deleteGoals") {
    const store = goalStore();
    const i = store.findIndex(
      (g) => String(g.app_goal_id) === path?.app_goal_id,
    );
    if (i >= 0) store.splice(i, 1);
    return { status: "SUCCESS" };
  }
  if (op === "getFundAllocations")
    return {
      items: path?.app_fund_id === "7000" ? allocationStore() : [],
    };
  if (op === "postFundAllocation") {
    const store = allocationStore();
    store.push({
      ...(body as Record<string, unknown>),
      alloc_id: Math.max(8000, ...store.map((a) => a.alloc_id)) + 1,
      alloc_status_code: "PENDING",
    });
    return { status: "SUCCESS" };
  }
  if (op === "putFundAllocations") {
    const store = allocationStore();
    const i = store.findIndex((a) => String(a.alloc_id) === path?.alloc_id);
    if (i >= 0) store[i] = { ...(body as FixtureAllocation) };
    return { status: "SUCCESS" };
  }
  if (op === "deleteFundAllocation") {
    const store = allocationStore();
    const i = store.findIndex((a) => String(a.alloc_id) === path?.alloc_id);
    if (i >= 0) store.splice(i, 1);
    return { status: "SUCCESS" };
  }
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
  if (op === "getSecurityUser_roles" && headers.p_obj_type === "CLAIMS")
    return {
      items: [
        ["claims-unit-summary", headers.p_obj_id === "6001" ? "N" : "Y"],
        ["unit-summary-edit", "Y"],
        ["unit-fund-allocations", "Y"],
        ["claims-unit-goals", "Y"],
        ["claims-unit-attachments", "Y"],
        ["unit-add-goal", "Y"],
        ["claims-unit-activities", "Y"],
        ["activity-details", "Y", "Y"],
      ].map(([page_name, read, remove = "N"], i) => ({
        page_id: 90 + i,
        page_name,
        component_type: "PAGE",
        read_access: read,
        edit_access: "Y",
        delete_access: remove,
      })),
    };
  if (op === "getAppSummary")
    return {
      items: [
        {
          app_id: 6000,
          unit_id: 202,
          org_unit_name: "Example Research University",
          fy_code: 2027,
          program_type_code: "SCHOOLWIDE",
          unit_category: null,
          program_preparer_name: "Fixture Preparer",
          program_preparer_title: "Coordinator",
          program_preparer_email: "preparer@example.test",
          program_preparer_phone: "0100",
          cfo_controller_name: "Fixture Controller",
          cfo_controller_email: "cfo@example.test",
          cfo_controller_phone: "0200",
          school_admin_name: "Fixture Admin",
          school_admin_sign_date: "2026-07-16T00:00:00Z",
        },
      ],
    };
  if (op === "getFundSummary")
    return {
      items: [
        [7000, "TITLE I (84.010A)", 18500, "2026-07-01~~2027-06-30", "DRFT"],
        [7001, "TITLE III (84.365A)", 10000, "~~", "IA"],
      ].map(([id, name, amount, period, status]) => ({
        app_fund_id: id,
        full_fund_display: name,
        fund_status_code: status,
        fund_status_value: LOOKUPS.FPCG_FUND_STATUS.find(
          ([code]) => code === status,
        )?.[1],
        original_allocation: amount,
        day20_adjustment: 0,
        other_adjustments: 0,
        total_budget: amount,
        unapplied_balance: amount,
        pending_allocation: 0,
        grant_period: period,
        last_date_for_amendment: "2027-03-31",
        last_date_for_claim: null,
      })),
    };
  if (op === "getStakeholders")
    return {
      items: [
        {
          stakeholder_id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          email_address: "ada@example.test",
          role_name: "Parent",
        },
      ],
    };
  if (op === "getMeetings")
    return {
      items: [
        { meeting_id: 1, meeting_date: "2026-04-17", description: "Kick-off" },
      ],
    };
  if (op === "getDocuments")
    return {
      items: [{ doc_id: 1, document_type_code: "ORG", description: "Chart" }],
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
