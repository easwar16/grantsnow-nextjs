import { loadSummary } from "@/server/proposals/record";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  app: undefined as unknown,
  transaction: undefined as unknown,
  save: vi.fn(),
  destroy: vi.fn(),
  calls: vi.fn(),
}));
vi.mock("@/server/session/storage", () => ({ storage: async () => state }));
vi.mock("@/server/api/transport", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.calls,
}));
import {
  authenticate,
  renewSession,
  clearSession,
} from "@/server/session/service";
import { GET as proposalsGet } from "@/app/api/proposals/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { widgetResult, loadWidget } from "@/server/home/service";
import { fixtureUser } from "@/test-support/fixtures";
const app = () => ({
  token: "isolated-test-token",
  subject: "test-sub",
  expiresAt: Date.now() + 600000,
  identityExpiresAt: Date.now() + 1200000,
  fixture: false,
});
const valid = () => ({
  ...fixtureUser,
  token: "isolated-test-token",
  expiry_datetime: new Date(Date.now() + 600000).toISOString(),
});
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  vi.stubEnv("FIXTURE_MODE", "false");
  state.app = app();
  state.transaction = undefined;
  state.calls.mockReset();
  state.save.mockReset();
  state.destroy.mockReset();
  state.calls.mockImplementation(async (op: string) => {
    if (op === "getSessionValidate" || op === "getSessionExtend_token")
      return valid();
    if (op === "getSecurityUser_roles")
      return { items: [{ page_name: "home", read_access: "Y" }] };
    if (op === "getSharedDashboardPreferences")
      return {
        needAttention: {
          pApproachingDeadlines: { isVisible: true },
          pPendingApprovals: { isVisible: true },
        },
        insights: {},
      };
    if (op === "getPre_awardGetLkpOrgUnitType")
      return { items: [{ org_unit_id: 202, org_unit_name: "Example" }] };
    return { items: [] };
  });
});
afterEach(() => vi.unstubAllEnvs());
it("direct API request without session returns 401 before Oracle", async () => {
  state.app = undefined;
  const response = await proposalsGet(
    new Request("http://127.0.0.1:3000/api/proposals"),
  );
  expect(response.status).toBe(401);
  expect(state.calls).not.toHaveBeenCalled();
});
it("direct API request with denied module returns 403", async () => {
  state.calls.mockResolvedValue({ ...valid(), module_access: [] });
  const response = await proposalsGet(
    new Request("http://127.0.0.1:3000/api/proposals"),
  );
  expect(response.status).toBe(403);
  expect(state.calls).not.toHaveBeenCalledWith(
    "getPre_awardGetProposalsList",
    expect.anything(),
    expect.anything(),
    expect.anything(),
  );
});
it("expired cookie cannot call Oracle", async () => {
  state.app = { ...app(), expiresAt: Date.now() - 1 };
  await expect(authenticate()).rejects.toMatchObject({ code: "EXPIRED" });
  expect(state.calls).not.toHaveBeenCalled();
});
it("validation preserves cookie expiry when Oracle omits it", async () => {
  const b = valid();
  const raw: Partial<typeof b> = { ...b };
  delete raw.expiry_datetime;
  state.calls.mockResolvedValue(raw);
  await expect(authenticate()).resolves.toHaveProperty("user.name");
});
it("validation cannot authorize an already expired backend lifetime", async () => {
  state.calls.mockResolvedValue({
    ...valid(),
    expiry_datetime: new Date(Date.now() - 1000).toISOString(),
  });
  await expect(authenticate()).rejects.toMatchObject({ code: "EXPIRED" });
});
it("unexpected validation token rotation fails closed without a writable session", async () => {
  state.calls.mockResolvedValue({
    ...valid(),
    token: "different-isolated-test-token",
  });
  await expect(authenticate()).rejects.toMatchObject({ code: "EXPIRED" });
  expect(state.save).not.toHaveBeenCalled();
});
it("renewal runs once and bounds expiry by identity expiry", async () => {
  state.calls.mockImplementation(async () => ({
    ...valid(),
    expiry_datetime: new Date(Date.now() + 3600000).toISOString(),
  }));
  await renewSession();
  expect(
    state.calls.mock.calls.filter((c) => c[0] === "getSessionExtend_token"),
  ).toHaveLength(1);
  expect(state.save).toHaveBeenCalledOnce();
});
it("logout clears local authority even on backend failure", async () => {
  state.calls.mockRejectedValue(new Error("down"));
  expect(await clearSession()).toBe(false);
  expect(state.destroy).toHaveBeenCalledOnce();
  expect(state.destroy.mock.invocationCallOrder[0]).toBeLessThan(
    state.calls.mock.invocationCallOrder[0],
  );
});
it("invalid callback consumes state without bootstrap", async () => {
  state.transaction = { expiresAt: Date.now() - 1 };
  const response = await callback(
    new Request("http://127.0.0.1:3000/api/auth/callback?code=bad"),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toContain("LOGIN_FAILED");
  expect(state.destroy).toHaveBeenCalled();
  expect(state.calls).not.toHaveBeenCalled();
});
it("widget failure is isolated from another queue", async () => {
  state.calls.mockImplementation(async (op: string) => {
    if (op === "getSessionValidate") return valid();
    if (op === "getSecurityUser_roles")
      return { items: [{ page_name: "home", read_access: "Y" }] };
    if (op === "getSharedDashboardPreferences")
      return {
        needAttention: {
          pApproachingDeadlines: { isVisible: true },
          pPendingApprovals: { isVisible: true },
        },
        insights: {},
      };
    if (op === "getPre_awardGetLkpOrgUnitType")
      return { items: [{ org_unit_id: 202, org_unit_name: "Example" }] };
    if (op === "getProposalProp_appr_deadline") throw new Error("down");
    return { items: [] };
  });
  const [a, b] = await Promise.all([
    widgetResult("pApproachingDeadlines", { offset: 0 }),
    widgetResult("pPendingApprovals", { offset: 0 }),
  ]);
  expect(a.ok).toBe(false);
  expect(b.ok).toBe(true);
});
it("verified org and statistics filter propagation never substitutes browser identity", async () => {
  state.calls.mockImplementation(async (op: string) => {
    if (op === "getSessionValidate") return valid();
    if (op === "getSecurityUser_roles")
      return { items: [{ page_name: "home", read_access: "Y" }] };
    if (op === "getSharedDashboardPreferences")
      return {
        needAttention: {},
        insights: { pByYearChart: { isVisible: true } },
      };
    if (op === "getPre_awardGetLkpOrgUnitType")
      return { items: [{ org_unit_id: 202, org_unit_name: "Example" }] };
    return { items: [] };
  });
  await loadWidget("pByYearChart", {
    organization: "202",
    year: "2026",
    month: "10",
    quarter: "4",
    offset: 0,
  });
  expect(state.calls).toHaveBeenCalledWith(
    "getProposalGetProposalStatistics",
    {
      token: "isolated-test-token",
      p_org_id: "202",
      chart_type: "YEAR_STATUS",
      year: "2026",
      month: "10",
      quarter: "4",
    },
    expect.any(URLSearchParams),
    undefined,
  );
});

it("summary denies missing object read access before fetching a record", async () => {
  await expect(
    loadSummary({ type: "PROPOSAL", id: "123" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.calls).toHaveBeenCalledWith("getSecurityUser_roles", {
    token: "isolated-test-token",
    p_obj_type: "PROPOSAL",
    p_obj_id: "123",
  });
  expect(
    state.calls.mock.calls.some((c) => c[0] === "getProposalProposal_id"),
  ).toBe(false);
});
it("summary direct boundary denies absent session before any Oracle request", async () => {
  state.app = undefined;
  await expect(
    loadSummary({ type: "PROPOSAL", id: "123" }),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  expect(state.calls).not.toHaveBeenCalled();
});
