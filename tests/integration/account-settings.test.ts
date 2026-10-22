import { it, expect, vi, beforeEach, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ oracle: vi.fn(), resources: vi.fn() }));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "private-test-token" },
    user: { personId: "12", modules: { "opportunities-finder": true } },
  }),
}));
vi.mock("@/server/configuration/resources", async (importOriginal) => ({
  resourceVisible: (
    await importOriginal<typeof import("@/server/configuration/resources")>()
  ).resourceVisible,
  resources: mocks.resources,
  label: () => "",
}));
vi.mock("@/server/configuration/service", () => ({
  organizations: async () => [{ id: "5", name: "Own organization" }],
}));
vi.mock("@/server/api/transport", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: mocks.oracle,
}));
vi.mock("@/server/configuration/environment", async (importOriginal) => ({
  assertWritesEnabled: (
    await importOriginal<typeof import("@/server/configuration/environment")>()
  ).assertWritesEnabled,
  fixtureMode: () => false,
  oracleSettings: () => ({ apps: new URL("https://oracle.example/ords/dev/") }),
}));
import { saveAccount } from "@/server/account/service";
beforeEach(() => {
  mocks.resources.mockResolvedValue([
    {
      module_name: "dashboard",
      label_type: "labels",
      label_name: "preference",
      is_visible: "Y",
    },
  ]);
  mocks.oracle.mockResolvedValue({
    theme: "theme-default",
    needAttention: { known: { isVisible: true } },
    insights: {},
    accessibility: {},
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  vi.stubEnv("WRITES_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("sends no live settings write while writes are off", async () => {
  vi.stubEnv("WRITES_ENABLED", "false");
  await expect(
    saveAccount("dashboard", { theme: "theme-dark" }),
  ).rejects.toMatchObject({ code: "WRITES_DISABLED" });
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects unknown widget keys before any Oracle write", async () => {
  await expect(
    saveAccount("dashboard", { needAttention: { unknown: true } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(fetch).not.toHaveBeenCalled();
});
it("handles business failure inside HTTP 200 as a failed save", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ response_msg: "ERROR" })),
  );
  await expect(
    saveAccount("dashboard", { theme: "theme-dark" }),
  ).rejects.toMatchObject({ code: "BUSINESS" });
});
it("uses token-bound research write and deduplicated source CSV without browser identity", async () => {
  await saveAccount("research", {
    research_areas: ["Medicine", "Medicine"],
    favourite_funder: [],
    research_keywords: [],
  });
  const [, init] = vi.mocked(fetch).mock.calls[0];
  expect(JSON.parse(String(init?.body))).toEqual({
    research_areas: "Medicine",
    favourite_funder: "",
    research_keywords: "",
  });
  expect(init?.cache).toBe("no-store");
});
it("denies research preference writes when the resource is hidden", async () => {
  mocks.resources.mockResolvedValue([]);
  await expect(
    saveAccount("research", {
      research_areas: [],
      favourite_funder: [],
      research_keywords: [],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(fetch).not.toHaveBeenCalled();
});
it("returning to Active clears stale proxies without directory access", async () => {
  mocks.resources.mockResolvedValue([
    {
      module_name: "dashboard",
      label_type: "labels",
      label_name: "manage",
      is_visible: "Y",
    },
  ]);
  mocks.oracle.mockResolvedValue({
    id: 27,
    status_code: "OOO",
    proxy_users: [{ id: 3, org_id: 999, proxy_pid: 998 }],
  });
  await saveAccount("status", {
    status_code: "ACTIVE",
    effective_start_date: "",
    effective_end_date: "",
    status_msg: "",
    proxy_users: [{ org_id: "999", proxy_pid: "998" }],
  });
  const [, init] = vi.mocked(fetch).mock.calls[0];
  expect(JSON.parse(String(init?.body))).toMatchObject({
    id: 27,
    pid: "12",
    status_code: "ACTIVE",
    proxy_users: [],
  });
  expect(mocks.oracle).not.toHaveBeenCalledWith(
    "getPre_awardGetPersonList",
    expect.anything(),
  );
});
it("posts only the contracted dashboard keys and keeps unedited switches", async () => {
  mocks.oracle.mockResolvedValue({
    theme: "theme-default",
    opportunity: true,
    needAttentionSwitch: false,
    insightsSwitch: true,
    needAttention: { known: { isVisible: true, ColSpan: 4 } },
    insights: {},
    accessibility: { accFontSize: { value: 25 } },
    token: "private-test-token",
    person_id: "99",
    response_msg: "SUCCESS",
  });
  await saveAccount("dashboard", { theme: "theme-dark" });
  const [, init] = vi.mocked(fetch).mock.calls[0];
  const body = JSON.parse(String(init?.body));
  expect(Object.keys(body).sort()).toEqual(
    [
      "accessibility",
      "insights",
      "insightsSwitch",
      "needAttention",
      "needAttentionSwitch",
      "opportunity",
      "theme",
    ].sort(),
  );
  expect(body.theme).toBe("theme-dark");
  expect(body.needAttention).toEqual({ known: true });
  expect(body.needAttentionSwitch).toBe(false);
  expect(body.accessibility.accFontSize).toBe("25");
});
