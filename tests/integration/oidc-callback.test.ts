import { it, beforeEach, afterEach, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  store: {
    app: undefined as unknown,
    transaction: undefined as unknown,
    save: vi.fn(),
    destroy: vi.fn(),
  },
  grant: vi.fn(),
  oracle: vi.fn(),
}));
vi.mock("@/server/identity/session/storage", () => ({
  storage: async () => mocks.store,
}));
vi.mock("@/server/identity/auth/oidc", () => ({
  idcs: async () => ({ tenant: "isolated-fake-oidc" }),
}));
vi.mock("openid-client", () => ({ authorizationCodeGrant: mocks.grant }));
vi.mock("@/server/oracle/connection", async (original) => ({
  ...(await original<object>()),
  oracle: mocks.oracle,
}));
import { GET } from "@/app/api/auth/callback/route";
import { fixtureUser } from "@/test-support/fixtures";
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  vi.stubEnv("FIXTURE_MODE", "false");
  vi.stubEnv("IDCS_COMPATIBILITY_CONFIRMED", "true");
  vi.stubEnv("IDCS_ISSUER", "https://idcs.example.invalid");
  vi.stubEnv(
    "IDCS_DISCOVERY_URL",
    "https://idcs.example.invalid/.well-known/openid-configuration",
  );
  vi.stubEnv("IDCS_CLIENT_AUTH_METHOD", "client_secret_basic");
  vi.stubEnv("IDCS_CLIENT_ID", "fake-client");
  vi.stubEnv("IDCS_CLIENT_SECRET", "fake-only");
  vi.stubEnv("IDCS_SCOPES", "openid profile");
  vi.stubEnv("IDCS_USERNAME_CLAIM", "preferred_username");
  mocks.store.app = undefined;
  mocks.store.transaction = {
    verifier: "fake-verifier",
    state: "fake-state",
    nonce: "fake-nonce",
    returnTo: "/proposals?search=health",
    expiresAt: Date.now() + 60000,
  };
  mocks.store.save.mockReset();
  mocks.store.destroy.mockReset();
  mocks.grant.mockReset();
  mocks.oracle.mockReset();
  mocks.grant.mockResolvedValue({
    claims: () => ({
      sub: "verified-sub",
      preferred_username: "trusted.owner",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  });
  mocks.oracle.mockResolvedValue({
    ...fixtureUser,
    token: "fake-backend",
    expiry_datetime: new Date(Date.now() + 60000).toISOString(),
  });
});
afterEach(() => vi.unstubAllEnvs());
it("hands PKCE/state/nonce and required ID token to the OIDC library, then uses verified identity", async () => {
  const response = await GET(
    new Request(
      "http://127.0.0.1:3000/api/auth/callback?code=fake&state=fake-state&username=admin",
    ),
  );
  expect(mocks.grant).toHaveBeenCalledWith(expect.anything(), expect.any(URL), {
    pkceCodeVerifier: "fake-verifier",
    expectedState: "fake-state",
    expectedNonce: "fake-nonce",
    idTokenExpected: true,
  });
  expect(mocks.oracle).toHaveBeenCalledWith("getSessionLogin", {
    username: "trusted.owner",
  });
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:3000/proposals?search=health",
  );
});
it("library rejection creates no application session and performs no bootstrap", async () => {
  mocks.grant.mockRejectedValue(new Error("invalid state/signature"));
  await GET(new Request("http://127.0.0.1:3000/api/auth/callback?code=bad"));
  expect(mocks.oracle).not.toHaveBeenCalled();
  expect(mocks.store.app).toBeUndefined();
  expect(mocks.store.destroy).toHaveBeenCalled();
});
it("unknown backend user in HTTP 200 creates no session", async () => {
  mocks.oracle.mockResolvedValue({ response_msg: "ERROR", token: "not-valid" });
  const response = await GET(
    new Request("http://127.0.0.1:3000/api/auth/callback?code=fake"),
  );
  expect(response.headers.get("location")).toContain("LOGIN_FAILED");
  expect(mocks.store.app).toBeUndefined();
});
it("a callback with no sign-in in progress leaves the current session alone", async () => {
  mocks.store.app = { token: "live-session" };
  mocks.store.transaction = undefined;
  const response = await GET(
    new Request("http://127.0.0.1:3000/api/auth/callback?code=forged"),
  );
  expect(mocks.store.destroy).not.toHaveBeenCalled();
  expect(mocks.store.app).toEqual({ token: "live-session" });
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:3000/login?reason=LOGIN_FAILED",
  );
});
