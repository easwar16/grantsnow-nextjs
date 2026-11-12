import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as Record<string, string>[],
  fundStatus: "DRFT",
  activityStatus: "DRFT",
  writes: [] as [string, unknown][],
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "t" },
    user: {
      organizationId: "202",
      modules: { "claims-group": true, "claims-unit-inquiry": true },
    },
  }),
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [],
}));
vi.mock("@/server/platform/configuration/formatting", () => ({
  globalVariables: async () => [
    { var_key: "FPCG_MAX_PAY_PERIOD", var_value: "28" },
    { var_key: "FPCG_MAX_MONTHLY_PERIOD", var_value: "13" },
  ],
}));
const lookup = (type: string, code: string, value = code) => ({
  lookup_type_code: type,
  lookup_code: code,
  lookup_code_value: value,
});
vi.mock("@/server/oracle/api", () => ({
  roles: { record: async () => ({ items: state.roles }) },
  lookups: {
    codes: async () => ({
      items: [
        lookup("FPCG_FTE_CODE", "1", "1.0"),
        lookup("FPCG_FTE_CODE", "2", "Stipend"),
        lookup("FPCG_PAY_FREQUENCY", "PAY_PERIOD", "Pay Period"),
        lookup("FPCG_SALARY_TYPE", "EXEMPT", "Exempt"),
        lookup("FPCG_SALARY_TYPE", "HOURLY", "Hourly"),
        lookup("FPCG_CALC_METHOD", "SALARY_PERCENT", "Percent Of Salary"),
        lookup("FPCG_CALC_METHOD", "FLAT_AMOUNT", "Flat Amount"),
      ],
    }),
  },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_FUNDS", "DRFT", "Y"],
        ["CLAIM_FUNDS", "IA", "N"],
        ["CLAIM_ACTIVITY", "DRFT", "Y"],
        ["CLAIM_ACTIVITY", "IA", "N"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({
      items: [
        {
          app_fund_id: 966,
          full_fund_display: "TITLE II",
          fund_type_id: 3,
          fund_status_code: state.fundStatus,
          fund_preferences: [],
        },
      ],
    }),
    fundCategories: async () => ({
      items: [{ fund_status_code: state.fundStatus, unapplied_balance: 0 }],
    }),
    activityTypeCodes: async () => ({
      items: [
        {
          activity_types: [
            {
              activity_type_code: "POSITION",
              activity_type_descr: "Position",
              function_codes: [
                {
                  function_code: "1000",
                  function_code_descr: "1000 - Instruction",
                  object_codes: [{ object_code: "100" }],
                },
              ],
            },
            {
              activity_type_code: "NON_POSITION",
              activity_type_descr: "Non Position",
              function_codes: [
                {
                  function_code: "1000",
                  function_code_descr: "1000 - Instruction",
                  object_codes: [
                    {
                      object_code: "300",
                      object_code_descr: "300 - Purchased Services",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
    categoryConfigs: async () => ({
      items: [
        {
          active_flag: "Y",
          category_code: "SOCIAL_SECURITY",
          category_name: "Social Security",
          category_type_code: "BENEFIT",
          calc_method_code: "SALARY_PERCENT",
          calc_method_editable_flag: "N",
          rate: 6.2,
        },
        {
          active_flag: "N",
          category_code: "OLD",
          category_type_code: "BENEFIT",
        },
      ],
    }),
    goals: async () => ({
      items: [{ app_goal_id: 1104, goal_number: "1", goal_description: "G" }],
    }),
    activity: async () => ({
      items: [
        {
          activity_id: 50,
          amend_version_id: 70,
          app_fund_id: 966,
          activity_status_code: state.activityStatus,
          activity_type_code: "NON_POSITION",
          function_code: "1000",
          object_code: "300",
          activity_gen_type: { amount: 1000 },
          itemization_text: "Old",
          reviewer_comments: "Keep me",
          created_from_amendment: "N",
          goals: [{ app_goal_id: 1104 }],
        },
      ],
    }),
    createActivity: async (p: unknown) => {
      state.writes.push(["create", p]);
      return { items: [{ activity_id: 51, amend_version_id: 71 }] };
    },
    updateActivity: async (p: unknown) => {
      state.writes.push(["update", p]);
      return { items: [{ activity_id: 50, amend_version_id: 70 }] };
    },
  },
}));
import {
  activityEditSetup,
  saveActivity,
} from "@/server/modules/claims/units/record/activity-edit";
import {
  itemRateOf,
  lineAmountOf,
  positionAmounts,
} from "@/shared/claims/activity-calc";

const blank = {
  homeless: "",
  type: "",
  func: "",
  object: "",
  fte: "",
  amount: "",
  salaryAmount: "",
  benefitsAmount: "",
  purchaseAmount: "",
  jobTitle: "",
  jobDescription: "",
  itemization: "",
  justification: "",
  goals: [] as string[],
  payFrequency: "",
  start: "",
  end: "",
  salaryType: "",
  totalSalary: "",
  deductSalary: "",
  hourlyRate: "",
  hoursPerDay: "",
  daysPerYear: "",
  salaryPercent: "",
  deductBenefit: "",
  benefitPercent: "",
  deductService: "",
  servicePercent: "",
  items: [] as {
    key: string;
    itemId: string;
    type: "BENEFIT" | "PURCHASE_SERVICE";
    category: string;
    method: string;
    rate: string;
    amount: string;
  }[],
};
const access = (page: string, edit: string) => ({
  page_name: page,
  read_access: "Y",
  edit_access: edit,
});
beforeEach(() => {
  state.roles = [
    access("claims-unit-summary", "Y"),
    access("claims-unit-activities", "Y"),
    access("activity-details", "Y"),
  ];
  state.fundStatus = "DRFT";
  state.activityStatus = "DRFT";
  state.writes = [];
});

describe("Add / Edit Activity setup", () => {
  it("lists the fund's codes, lookups, active categories and goals", async () => {
    const view = await activityEditSetup("1065", { fund: "966" });
    expect(view.types.map((t) => t.value)).toEqual([
      "POSITION",
      "NON_POSITION",
    ]);
    expect(view.functions.POSITION).toEqual([
      { value: "1000", label: "1000 - Instruction" },
    ]);
    expect(view.objects["NON_POSITION|1000"][0].value).toBe("300");
    expect(view.categories.map((c) => c.code)).toEqual(["SOCIAL_SECURITY"]);
    expect(view.categories[0].rate).toBe(6.2);
    expect(view.periods).toEqual({ MONTHLY: 13, PAY_PERIOD: 28 });
    expect(view.goals).toEqual([{ value: "1104", label: "1 - G" }]);
  });
  it("refuses Add without activity-details edit or in a fund status with no user edit", async () => {
    state.fundStatus = "IA";
    await expect(
      activityEditSetup("1065", { fund: "966" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    state.fundStatus = "DRFT";
    state.roles = state.roles.map((r) =>
      r.page_name === "activity-details" ? { ...r, edit_access: "N" } : r,
    );
    await expect(
      activityEditSetup("1065", { fund: "966" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("Save Activity", () => {
  it("creates a position with legacy's body: object 100, whole percentages, amounts computed here", async () => {
    const result = await saveActivity("1065", {
      fund: "966",
      draft: {
        ...blank,
        type: "POSITION",
        func: "1000",
        fte: "1",
        jobTitle: "Teacher",
        jobDescription: "Teaches",
        itemization: "Pos",
        goals: ["1104"],
        payFrequency: "PAY_PERIOD",
        start: "1",
        end: "6",
        salaryType: "HOURLY",
        // Ignored for HOURLY: the total is rate × hours × days.
        totalSalary: "1",
        hourlyRate: "20",
        hoursPerDay: "8",
        daysPerYear: "25",
        salaryPercent: "100",
        benefitPercent: "100",
        items: [
          {
            key: "N1",
            itemId: "",
            type: "BENEFIT",
            category: "SOCIAL_SECURITY",
            method: "SALARY_PERCENT",
            rate: "6.2",
            // A stale amount from the browser is not trusted.
            amount: "999",
          },
        ],
      },
    });
    expect(result).toMatchObject({ activity: "51", version: "71" });
    const [kind, call] = state.writes[0] as [
      string,
      { appFundId: number; body: Record<string, unknown> },
    ];
    expect(kind).toBe("create");
    expect(call.appFundId).toBe(966);
    expect(call.body).toMatchObject({
      activity_type_code: "POSITION",
      object_code: "100",
      goals: [1104],
      created_from_amendment: "N",
      activity_position_type: {
        total_salary: 4000,
        salary_percent: 100,
        benefit_percent: 100,
        benefits_amount: 248,
        activity_cost_items: [
          {
            category_code: "SOCIAL_SECURITY",
            calc_method_code: "SALARY_PERCENT",
            rate: 6.2,
            amount: 248,
          },
        ],
      },
    });
  });
  it("refuses a new activity with no goal (legacy's check missed new ones) and a code not on the fund", async () => {
    const base = {
      ...blank,
      type: "NON_POSITION",
      func: "1000",
      object: "300",
      amount: "10",
      itemization: "x",
    };
    await expect(
      saveActivity("1065", { fund: "966", draft: base }),
    ).rejects.toMatchObject({ message: "Please add at least one goal." });
    await expect(
      saveActivity("1065", {
        fund: "966",
        draft: { ...base, goals: ["1104"], object: "999" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toHaveLength(0);
  });
  it("updates a version and keeps its reviewer comments; an approved version is refused", async () => {
    await saveActivity("1065", {
      fund: "966",
      activity: "50",
      version: "70",
      draft: {
        ...blank,
        type: "NON_POSITION",
        func: "1000",
        object: "300",
        amount: "1200",
        itemization: "New",
        goals: ["1104"],
      },
    });
    const [kind, call] = state.writes[0] as [
      string,
      { activityId: number; versionId: number; body: Record<string, unknown> },
    ];
    expect(kind).toBe("update");
    expect(call).toMatchObject({ activityId: 50, versionId: 70 });
    expect(call.body).toMatchObject({
      reviewer_comments: "Keep me",
      activity_gen_type: { amount: 1200 },
      itemization_text: "New",
    });
    state.activityStatus = "IA";
    await expect(
      activityEditSetup("1065", { fund: "966", activity: "50", version: "70" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("activity calculations (legacy formulas)", () => {
  it("salary × % − deduction, and each line type the same way", () => {
    expect(
      positionAmounts({
        salaryType: "EXEMPT",
        totalSalary: 5000,
        deductSalary: 100,
        hourlyRate: null,
        hoursPerDay: null,
        daysPerYear: null,
        salaryPercent: 50,
        deductBenefit: 10,
        benefitPercent: 100,
        deductService: null,
        servicePercent: null,
        items: [{ type: "BENEFIT", amount: 310 }],
      }),
    ).toEqual({ totalSalary: 5000, salary: 2400, benefits: 300, purchase: 0 });
  });
  it("Percent of Salary follows the salary; Flat Amount keeps its amount and derives the rate", () => {
    expect(lineAmountOf(5000, "SALARY_PERCENT", 6.2, 1)).toBe(310);
    expect(lineAmountOf(5000, "FLAT_AMOUNT", 6.2, 120)).toBe(120);
    expect(itemRateOf(5000, 125)).toBe(2.5);
    expect(itemRateOf(0, 125)).toBe(0);
  });
});
