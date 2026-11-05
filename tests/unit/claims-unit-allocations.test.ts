import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as {
    page_name: string;
    read_access: string;
    edit_access: string;
  }[],
  config: [] as Record<string, string>[],
  funds: [] as Record<string, unknown>[],
  allocations: [] as Record<string, unknown>[],
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
          lookup_type_code: "FPCG_ALLOC_TYPE",
          lookup_code: "ORIGINAL",
          lookup_code_value: "Original",
        },
        {
          lookup_type_code: "FPCG_ALLOC_STATUS",
          lookup_code: "PENDING",
          lookup_code_value: "Pending",
        },
      ],
    }),
  },
  claims: {
    appSummary: async () => ({ items: [{ app_id: 1 }] }),
    appFundSummary: async () => ({ items: state.funds }),
    statusConfigs: async () => ({ items: state.config }),
    fundAllocations: async () => ({ items: state.allocations }),
    createAllocation: async (p: unknown) =>
      void state.writes.push(["create", p]),
    updateAllocation: async (p: unknown) =>
      void state.writes.push(["update", p]),
    deleteAllocation: async (p: unknown) =>
      void state.writes.push(["delete", p]),
  },
}));
import {
  allocationsView,
  deleteAllocation,
  saveAllocation,
  statusConfig,
} from "@/server/modules/claims/units/record/allocations";

const role = (page: string, edit = "Y") => ({
  page_name: page,
  read_access: "Y",
  edit_access: edit,
  delete_access: "N",
});
let app = 2000;
// Each test opens its own application, as the record context is held per request.
const next = () => String(app++);
beforeEach(() => {
  state.roles = [role("claims-unit-summary"), role("unit-fund-allocations")];
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
    {
      transaction_type: "CLAIM_FUNDS_AMENDMENT",
      status_lookup_code: "ADJ_DRFT",
      allow_user_edit: "Y",
    },
  ];
  state.funds = [
    { app_fund_id: 7000, fund_status_code: "DRFT" },
    { app_fund_id: 7001, fund_status_code: "IA" },
  ];
  state.allocations = [
    {
      alloc_id: 8000,
      alloc_type_code: "ORIGINAL",
      alloc_status_code: "PENDING",
      alloc_date: "2026-07-01T00:00:00Z",
      amount: 18500,
      app_id: 6000,
      fund_type_id: 1,
      unknown_column: "dropped",
    },
  ];
  state.writes = [];
});

it("merges status configs as legacy loadStatusConfig: any Y row allows the edit", async () => {
  state.config.push({
    transaction_type: "CLAIM_FUNDS",
    status_lookup_code: "IA",
    allow_user_edit: "Y",
  });
  await expect(statusConfig()).resolves.toEqual({
    CLAIM_FUNDS: { DRFT: true, IA: true },
    CLAIM_FUNDS_AMENDMENT: { ADJ_DRFT: true },
  });
});

it("shows the fund's allocations with lookup options; refuses a fund that is not the application's", async () => {
  const view = await allocationsView(next(), "7000");
  expect(view.rows).toEqual([
    {
      key: "8000",
      type: "ORIGINAL",
      status: "PENDING",
      date: "2026-07-01T00:00:00Z",
      amount: 18500,
    },
  ]);
  expect(view.types).toEqual([{ value: "ORIGINAL", label: "Original" }]);
  expect(view.statuses).toEqual([{ value: "PENDING", label: "Pending" }]);
  await expect(allocationsView(next(), "9999")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(allocationsView(next(), "x")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("creates with only type, date and amount; refuses a negative amount", async () => {
  await saveAllocation(next(), {
    fund: "7000",
    type: "ORIGINAL",
    date: "2026-08-01",
    amount: "250",
  });
  expect(state.writes).toEqual([
    [
      "create",
      {
        appFundId: 7000,
        body: {
          alloc_type_code: "ORIGINAL",
          alloc_date: "2026-08-01",
          amount: 250,
        },
      },
    ],
  ]);
  await expect(
    saveAllocation(next(), { fund: "7000", type: "", date: "", amount: "-1" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("updates the row as read with the three fields replaced; an unchanged date keeps its stored value", async () => {
  await saveAllocation(next(), {
    fund: "7000",
    allocId: "8000",
    type: "ORIGINAL",
    date: "2026-07-01",
    amount: "100",
  });
  const [kind, p] = state.writes[0] as [
    string,
    { body: Record<string, unknown> },
  ];
  expect(kind).toBe("update");
  expect(p.body).toMatchObject({
    alloc_id: 8000,
    app_id: 6000,
    alloc_date: "2026-07-01T00:00:00Z",
    amount: 100,
  });
  expect(p.body).not.toHaveProperty("unknown_column");
});

it("refuses writes without the allocations edit right, on a locked status, or for another fund's allocation", async () => {
  const body = { fund: "7000", type: "", date: "", amount: "1" };
  state.roles = [
    role("claims-unit-summary"),
    role("unit-fund-allocations", "N"),
  ];
  await expect(saveAllocation(next(), body)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.roles = [role("claims-unit-summary"), role("unit-fund-allocations")];
  await expect(
    saveAllocation(next(), { ...body, fund: "7001" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  // Legacy needs both config maps; without the amendment one every button stays disabled.
  state.config = state.config.filter(
    (c) => c.transaction_type === "CLAIM_FUNDS",
  );
  await expect(saveAllocation(next(), body)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.config.push({
    transaction_type: "CLAIM_FUNDS_AMENDMENT",
    status_lookup_code: "ADJ_DRFT",
    allow_user_edit: "Y",
  });
  await expect(
    deleteAllocation(next(), { fund: "7000", allocId: "9" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await deleteAllocation(next(), { fund: "7000", allocId: "8000" });
  expect(state.writes).toEqual([["delete", { allocId: 8000 }]]);
});
