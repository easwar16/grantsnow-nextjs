import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({
    token: "session-token",
    identity: { legal_id: "202", org_id: "13510", user_id: "5565" },
  }),
}));
import { flow } from "@/server/oic/flows";
import * as oic from "@/server/oic/api/catalogue";
const fetchMock = vi.fn();
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "development",
    APP_ENV: "development",
    FIXTURE_MODE: "false",
    OIC_BASE_URL: "https://oic.example",
    GN_OIC_USER: "user",
    GN_OIC_PASSWORD: "secret",
    WRITES_ENABLED: "true",
  }))
    vi.stubEnv(key, value);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const status = oic.getCHECK_DOCUSIGN_ENVELOPE_STATUS1_0EnvelopeEnvelope_id;
it("sends identity from the session and Basic auth, never the session token unless the flow requires it", async () => {
  await status({ envelope_id: "env-1", contract_id: 7 });
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(
    "https://oic.example/ic/api/integration/v1/flows/rest/CHECK_DOCUSIGN_ENVELOPE_STATUS/1.0/envelope/env-1",
  );
  expect(init.headers).toMatchObject({
    legal_id: "202",
    org_id: "13510",
    user_id: "5565",
    contract_id: "7",
    Authorization: `Basic ${Buffer.from("user:secret").toString("base64")}`,
  });
  expect(init.headers.token).toBeUndefined();
});
it("refuses an unsafe path value and a header the flow does not declare", async () => {
  await expect(status({ envelope_id: "../x" })).rejects.toMatchObject({
    status: 400,
  });
  const smuggled = flow<void>({
    op: "getGET_OBJECT_VERSIONS1_0Objectversions",
    headers: () => ({ token: "x" }),
  });
  await expect(smuggled()).rejects.toMatchObject({ status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("keeps every write behind the writes gate and simulates it under fixtures", async () => {
  vi.stubEnv("WRITES_ENABLED", "false");
  await expect(
    oic.postFP_GRANT_TO_ERP_AWARD_V2_2_0GrantsToERP({ body: { AwardId: 1 } }),
  ).rejects.toMatchObject({ code: "WRITES_DISABLED" });
  vi.stubEnv("FIXTURE_MODE", "true");
  vi.stubEnv("DEV_BROWSER_SESSION", "false");
  await expect(
    oic.postFP_GRANT_TO_ERP_AWARD_V2_2_0GrantsToERP({ body: { AwardId: 1 } }),
  ).resolves.toEqual({});
  expect(fetchMock).not.toHaveBeenCalled();
});
it("refuses the flow whose path the legacy contract leaves empty", async () => {
  await expect(
    oic.getIcApiIntegrationV1FlowsRestUNIT4_MAIN_FLOW1_0Unit4integration({
      body: {},
    }),
  ).rejects.toMatchObject({ code: "CONTRACT" });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("reports a business failure inside a 200 reply", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({ error_code: "E1", error_description: "No envelope" }),
      { status: 200 },
    ),
  );
  await expect(status({ envelope_id: "env-1" })).rejects.toMatchObject({
    code: "BUSINESS",
    message: "E1 : No envelope",
  });
});
