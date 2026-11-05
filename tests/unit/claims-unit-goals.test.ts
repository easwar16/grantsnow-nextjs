import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as Record<string, string>[],
  config: [] as Record<string, string>[],
  funds: [] as Record<string, unknown>[],
  goal: null as Record<string, unknown> | null,
  offered: [] as Record<string, unknown>[],
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
  claims: {
    appSummary: async () => ({ items: [{ app_id: 1, fy_code: 2027 }] }),
    statusConfigs: async () => ({ items: state.config }),
    appFunds: async () => ({ items: state.funds }),
    goals: async () => ({ items: state.goal ? [state.goal] : [] }),
    goalDetails: async () => ({ items: state.goal ? [state.goal] : [] }),
    fundGoals: async () => ({ items: state.offered }),
    createGoal: async (p: unknown) => void state.writes.push(["create", p]),
    updateGoal: async (p: unknown) => void state.writes.push(["update", p]),
    deleteGoal: async (p: unknown) => void state.writes.push(["delete", p]),
  },
}));
import {
  deleteGoal,
  goalsView,
  saveGoal,
} from "@/server/modules/claims/units/record/goals";
import { available } from "@/server/modules/claims/units/record/status";

const role = (page: string, edit = "Y") => ({
  page_name: page,
  read_access: "Y",
  edit_access: edit,
  delete_access: "N",
});
let app = 3000;
const next = () => String(app++);
const body = {
  fund: "966",
  fiscalYear: "2027",
  goalId: "13",
  description: "Typed",
  evaluation: "E",
  reviewerComments: "R",
};
beforeEach(() => {
  state.roles = [
    role("claims-unit-summary"),
    role("claims-unit-goals"),
    role("unit-add-goal"),
  ];
  state.config = [
    {
      transaction_type: "CLAIM_FUNDS",
      status_lookup_code: "DRFT",
      allow_user_edit: "Y",
    },
    {
      transaction_type: "CLAIM_FUNDS",
      status_lookup_code: "IA",
      allow_user_edit: "N",
    },
  ];
  state.funds = [
    {
      app_fund_id: 966,
      full_fund_display: "TITLE II",
      fund_status_code: "DRFT",
      fund_type_id: 2,
    },
    {
      app_fund_id: 968,
      full_fund_display: "TITLE IV",
      fund_status_code: "IA",
      fund_type_id: 4,
    },
  ];
  state.goal = null;
  state.offered = [
    {
      goal_id: 11,
      goal_number: "1",
      goal_description: "System goal",
      category: "SYSTEM",
    },
    { goal_id: 13, goal_number: "3", goal_description: "", category: "USER" },
  ];
  state.writes = [];
});

it("isAvailable as legacy: configured for a type and forbidden by none", () => {
  const config = { CLAIM_FUNDS: { DRFT: true, IA: false } };
  expect(
    available(config, ["CLAIM_FUNDS", "CLAIM_FUNDS_AMENDMENT"], "DRFT"),
  ).toBe(true);
  expect(available(config, ["CLAIM_FUNDS"], "IA")).toBe(false);
  expect(available(config, ["CLAIM_FUNDS"], "OTHER")).toBe(false);
  expect(available(config, ["CLAIM_FUNDS"], "")).toBe(false);
});

it("opens on the first fund; a locked fund's goals show without edit, a foreign fund is refused", async () => {
  const first = await goalsView(next(), null);
  expect(first).toMatchObject({ fund: "966", editable: true, canManage: true });
  const locked = await goalsView(next(), "968");
  expect(locked.editable).toBe(false);
  await expect(goalsView(next(), "1")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it("creates with the offered goal's number and category; a SYSTEM goal keeps its own description", async () => {
  await saveGoal(next(), body);
  expect(state.writes[0]).toEqual([
    "create",
    {
      appFundId: 966,
      body: expect.objectContaining({
        goal_id: 13,
        goal_number: "3",
        category: "USER",
        goal_description: "Typed",
        fy_code: 2027,
        evaluation_text: "E",
      }),
    },
  ]);
  await saveGoal(next(), { ...body, goalId: "11" });
  expect(state.writes[1]).toMatchObject([
    "create",
    { body: { goal_description: "System goal", category: "SYSTEM" } },
  ]);
  await expect(
    saveGoal(next(), { ...body, goalId: "99" }),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("updates the goal as read, keeps its fiscal year and drops the linked activities from the body", async () => {
  state.goal = {
    app_goal_id: 5,
    app_fund_id: 966,
    fy_code: 2026,
    goal_id: 13,
    linked_activities: [],
  };
  await saveGoal(next(), { ...body, goal: "5" });
  const [kind, p] = state.writes[0] as [
    string,
    { body: Record<string, unknown> },
  ];
  expect(kind).toBe("update");
  expect(p.body).toMatchObject({
    app_goal_id: 5,
    fy_code: 2026,
    evaluation_text: "E",
  });
  expect(p.body).not.toHaveProperty("linked_activities");
});

it("refuses writes without unit-add-goal, on a locked fund, and deleting a linked goal", async () => {
  state.roles = [
    role("claims-unit-summary"),
    role("claims-unit-goals"),
    role("unit-add-goal", "N"),
  ];
  await expect(saveGoal(next(), body)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.roles = [
    role("claims-unit-summary"),
    role("claims-unit-goals"),
    role("unit-add-goal"),
  ];
  await expect(
    saveGoal(next(), { ...body, fund: "968" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  state.goal = {
    app_goal_id: 5,
    app_fund_id: 966,
    linked_activities: [{ activity_number: 1 }],
  };
  await expect(
    deleteGoal(next(), { fund: "966", goal: "5" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  state.goal = { app_goal_id: 5, app_fund_id: 967 };
  await expect(
    deleteGoal(next(), { fund: "966", goal: "5" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.writes).toEqual([]);
});
