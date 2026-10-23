import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  app: undefined as Record<string, unknown> | undefined,
  save: vi.fn(),
  destroy: vi.fn(),
  calls: vi.fn(),
}));
vi.mock("@/server/identity/session/storage", () => ({
  storage: async () => state,
}));
vi.mock("@/server/oracle/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.calls,
}));
import { authenticate, renewSession } from "@/server/identity/session/service";
import { mapValidatedIdentity } from "@/server/identity/session/contracts";
import { DEV_SESSION_LEASE_MS } from "@/server/identity/session/browser-session";
import { POST as renewRoute } from "@/app/api/auth/renew/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { fixtureUser } from "@/test-support/fixtures";
const origin = "http://127.0.0.1:3000";
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
let session: Record<string, unknown>;
function backend(extend: Record<string, unknown>) {
  state.calls.mockImplementation(
    async (op: string, headers: { token: string }) =>
      op === "getSessionExtend_token"
        ? extend
        : { ...fixtureUser, token: headers.token },
  );
}
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "development",
    APP_ENV: "development",
    FIXTURE_MODE: "false",
    APP_ORIGIN: origin,
  }))
    vi.stubEnv(key, value);
  state.save.mockReset();
  state.calls.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("browser-session renewal (D37)", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_BROWSER_SESSION", "true");
    session = {
      token: "old-token",
      subject: "dev-backend:101",
      expiresAt: Date.now() + 120000,
      identityExpiresAt: Date.now() + 4 * 3600000,
      fixture: false,
      source: "browser-session",
    };
    state.app = { ...session };
  });
  it("extends through the backend and stores a rotated token and expiry", async () => {
    backend({ token: "new-token", expiry_datetime: iso(30 * 60000) });
    const expiresAt = await renewSession();
    expect(state.calls).toHaveBeenCalledWith("getSessionExtend_token", {
      token: "old-token",
    });
    expect(state.app).toMatchObject({ token: "new-token", expiresAt });
    expect(expiresAt).toBeGreaterThan(session.expiresAt as number);
    expect(state.save).toHaveBeenCalledOnce();
  });
  it("validates the rotated token afterwards instead of rejecting it as changed", async () => {
    backend({ token: "new-token", expiry_datetime: iso(30 * 60000) });
    await renewSession();
    state.calls.mockClear();
    const { session: next } = await authenticate();
    expect(state.calls).toHaveBeenCalledWith("getSessionValidate", {
      token: "new-token",
    });
    expect(next.token).toBe("new-token");
  });
  it.each([
    ["absent", {}],
    ["unparseable", { expiry_datetime: "soon" }],
    ["past", { expiry_datetime: iso(-60000) }],
  ])("keeps the current lease when the expiry is %s", async (_, extend) => {
    backend(extend);
    expect(await renewSession()).toBe(session.expiresAt);
    expect(state.app?.token).toBe("old-token");
  });
  it("never extends past the lease or the identity expiry", async () => {
    backend({ expiry_datetime: iso(24 * 3600000) });
    const expiresAt = await renewSession();
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + DEV_SESSION_LEASE_MS);
    expect(expiresAt).toBeLessThanOrEqual(session.identityExpiresAt as number);
  });
  it("surfaces a business refusal verbatim and stores nothing", async () => {
    backend({
      response_msg: "ERROR",
      error_code: "S1",
      error_description: "Cannot extend",
      preventive_action: "Sign in again",
    });
    const response = await renewRoute(
      new Request(`${origin}/api/auth/renew`, {
        method: "POST",
        headers: { origin },
      }),
    );
    expect(await response.json()).toEqual({
      error: {
        code: "BUSINESS",
        message: "S1 : Cannot extend",
        action: "Sign in again",
      },
    });
    expect(state.save).not.toHaveBeenCalled();
  });
  it("answers a dead token with 401 so the client signs in again", async () => {
    backend({ ERROR_MSG: "Context Not Set" });
    const response = await renewRoute(
      new Request(`${origin}/api/auth/renew`, {
        method: "POST",
        headers: { origin },
      }),
    );
    expect(response.status).toBe(401);
    expect(state.save).not.toHaveBeenCalled();
  });
  it("refuses a cross-origin renewal before calling Oracle", async () => {
    const response = await renewRoute(
      new Request(`${origin}/api/auth/renew`, {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(response.status).toBe(403);
    expect(state.calls).not.toHaveBeenCalled();
  });
});
describe("IDCS renewal", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_BROWSER_SESSION", "false");
    session = {
      token: "old-token",
      subject: "sub",
      expiresAt: Date.now() + 120000,
      identityExpiresAt: Date.now() + 3600000,
      fixture: false,
    };
    state.app = { ...session };
  });
  it("stores the rotated token, bounded by the identity expiry", async () => {
    backend({
      ...fixtureUser,
      token: "new-token",
      expiry_datetime: iso(8 * 3600000),
    });
    const expiresAt = await renewSession();
    expect(state.app?.token).toBe("new-token");
    expect(expiresAt).toBe(session.identityExpiresAt);
  });
});
describe("session expiry endpoint", () => {
  it("returns only the local expiry, without calling Oracle", async () => {
    vi.stubEnv("DEV_BROWSER_SESSION", "false");
    state.app = {
      token: "secret-token",
      subject: "sub",
      expiresAt: Date.now() + 120000,
      identityExpiresAt: Date.now() + 3600000,
      fixture: false,
    };
    const response = await sessionRoute(
      new Request(`${origin}/api/auth/session`),
    );
    const body = await response.json();
    expect(body).toEqual({ expiresAt: state.app.expiresAt });
    expect(JSON.stringify(body)).not.toContain("secret-token");
    expect(state.calls).not.toHaveBeenCalled();
  });
  it("answers 401 without a session", async () => {
    state.app = undefined;
    expect(
      (await sessionRoute(new Request(`${origin}/api/auth/session`))).status,
    ).toBe(401);
  });
});
describe("D45 legal_id", () => {
  it("maps legal_id into the server-side user context", () =>
    expect(
      mapValidatedIdentity({ ...fixtureUser, token: "t", legal_id: 202 }).user
        .legalId,
    ).toBe("202"));
  it.each([undefined, null, ""])(
    "degrades a missing legal_id (%j) to absent",
    (legal_id) =>
      expect(
        mapValidatedIdentity({ ...fixtureUser, token: "t", legal_id }).user,
      ).not.toHaveProperty("legalId"),
  );
});
