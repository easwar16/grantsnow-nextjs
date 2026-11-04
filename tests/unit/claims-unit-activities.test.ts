import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as Record<string, string>[],
  activities: [] as Record<string, unknown>[],
  balances: [] as number[],
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
vi.mock("@/server/oracle/api", () => ({
  roles: { record: async () => ({ items: state.roles }) },
  lookups: {
    codes: async () => ({
      items: [
        {
          lookup_type_code: "FPCG_FUND_STATUS",
          lookup_code: "DRFT",
          lookup_code_value: "Original Pending",
        },
      ],
    }),
  },
  claims: {
    statusConfigs: async () => ({
      items: [
        {
          transaction_type: "CLAIM_ACTIVITY",
          status_lookup_code: "DRFT",
          allow_user_edit: "Y",
        },
        {
          transaction_type: "CLAIM_ACTIVITY",
          status_lookup_code: "IA",
          allow_user_edit: "N",
        },
      ],
    }),
    appFunds: async () => ({
      items: [{ app_fund_id: 966, full_fund_display: "TITLE II" }],
    }),
    fundCategories: async () => ({
      items: [
        {
          fund_status_code: "DRFT",
          total_budget: 100,
          unapplied_balance: state.balances.shift() ?? 0,
          categories: [{ category: "Activities", pending: 2 }],
        },
      ],
    }),
    activitySummary: async () => ({
      items: [
        {
          function_code: "1000",
          obj_100: 10,
          obj_200: null,
          function_total: 10,
        },
        { function_code: "2000", obj_100: "5", function_total: 5 },
      ],
    }),
    activities: async () => ({ items: state.activities }),
    deleteActivity: async (p: unknown) => void state.writes.push(["delete", p]),
  },
}));
import {
  activitiesView,
  activityListView,
  deleteActivity,
  fundSummaryView,
} from "@/server/modules/claims/units/record/activities";

const role = (page: string, remove = "N") => ({
  page_name: page,
  read_access: "Y",
  edit_access: "Y",
  delete_access: remove,
});
let app = 4000;
const next = () => String(app++);
beforeEach(() => {
  state.roles = [
    role("claims-unit-summary"),
    role("claims-unit-activities"),
    role("activity-details", "Y"),
  ];
  state.activities = [
    {
      activity_id: 1,
      amend_version_id: 1,
      status_code: "DRFT",
      total_amount: 10,
    },
    {
      activity_id: 2,
      amend_version_id: 3,
      status_code: "IA",
      total_amount: null,
    },
  ];
  state.balances = [];
  state.writes = [];
});

it("opens on the first fund with its status name and amounts", async () => {
  const view = await activitiesView(next(), null);
  expect(view.fund).toBe("966");
  expect(view.status.value).toBe("Original Pending");
  expect(view.amounts[0]).toMatchObject({
    key: "total-allocation",
    value: 100,
  });
  expect(view.statuses[0]).toEqual({ value: "", label: "All" });
  await expect(activitiesView(next(), "1")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it("sums the fund summary as legacy: a missing amount adds 0", async () => {
  const sum = await fundSummaryView(next(), "966", null);
  expect(sum.totals).toMatchObject({ salaries: 15, benefits: 0, total: 15 });
  expect(sum.rows[0].benefits).toBeNull();
});

it("lets only an editable status be deleted, and only with activity-details delete", async () => {
  const list = await activityListView(next(), "966", "");
  expect(list.rows.map((r) => r.deletable)).toEqual([true, false]);
  expect(list.total).toBe(10);
  state.roles[2] = role("activity-details");
  const locked = await activityListView(next(), "966", "");
  expect(locked.rows.some((r) => r.deletable)).toBe(false);
});

it("deletes a version on the fund, refuses others, and warns when the balance turns negative", async () => {
  await expect(
    deleteActivity(next(), { fund: 966, activity: 2, version: 3 }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    deleteActivity(next(), { fund: 966, activity: 1, version: 9 }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.writes).toEqual([]);
  state.balances = [5, -5];
  const result = await deleteActivity(next(), {
    fund: 966,
    activity: 1,
    version: 1,
  });
  expect(state.writes).toEqual([["delete", { activityId: 1, versionId: 1 }]]);
  expect(result.warning?.summary).toMatch(/Unapplied Balance is negative/);
});
