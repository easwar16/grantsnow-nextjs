import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  read: vi.fn(),
  stat: vi.fn(),
  oracle: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: state.read, stat: state.stat }));
vi.mock("@/server/api/transport", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.oracle,
}));
import {
  capturedBrowserSession,
  DEV_SESSION_LEASE_MS,
  parsePastedToken,
  pastedBrowserSession,
} from "@/server/session/browser-session";
import { fixtureUser } from "@/test-support/fixtures";
const base = "https://dev.example/ords/dev_base/";
const apps = "https://dev.example/ords/dev/";
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "development",
    APP_ENV: "development",
    DEV_BROWSER_SESSION: "true",
    FIXTURE_MODE: "false",
    APP_ORIGIN: "http://127.0.0.1:3000",
    ORDS_BASE_URL: base,
    ORDS_APPS_URL: apps,
  }))
    vi.stubEnv(key, value);
  state.read.mockReset();
  state.stat.mockReset();
  state.oracle.mockReset();
  state.stat.mockResolvedValue({
    mode: 0o100600,
    size: 500,
    uid: process.getuid?.(),
    isFile: () => true,
  });
  state.read.mockResolvedValue(
    JSON.stringify({
      token: "isolated-test-token",
      capturedAt: new Date().toISOString(),
      expiresAt: Date.now() + 3600000,
      baseUrl: base,
      appsUrl: apps,
    }),
  );
  state.oracle.mockResolvedValue({
    ...fixtureUser,
    token: "isolated-test-token",
    private_secret: "not-display-data",
  });
});
afterEach(() => vi.unstubAllEnvs());
it("validates the token before creating a minimal bounded local session", async () => {
  const b = await capturedBrowserSession();
  expect(state.oracle).toHaveBeenCalledWith("getSessionValidate", {
    token: "isolated-test-token",
  });
  expect(b.expiresAt).toBeLessThanOrEqual(Date.now() + DEV_SESSION_LEASE_MS);
  expect(JSON.stringify(b.user)).not.toContain("private_secret");
  expect(JSON.stringify(b.user)).not.toContain("isolated-test-token");
});
it("refuses production before reading the private token file", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(capturedBrowserSession()).rejects.toThrow();
  expect(state.read).not.toHaveBeenCalled();
});
it.each([
  { mode: 0o100644 },
  { size: 8193 },
  { uid: -1 },
  { isFile: () => false },
])(
  "rejects unprotected capture %j before token validation",
  async (override) => {
    state.stat.mockResolvedValue({
      mode: 0o100600,
      size: 500,
      uid: process.getuid?.(),
      isFile: () => true,
      ...override,
    });
    await expect(capturedBrowserSession()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(state.oracle).not.toHaveBeenCalled();
  },
);
it.each([{ expiresAt: 0 }, { appsUrl: "https://other.example/ords/dev/" }])(
  "rejects expired or mismatched destination captures",
  async (override) => {
    state.read.mockResolvedValue(
      JSON.stringify({
        token: "isolated-test-token",
        capturedAt: new Date().toISOString(),
        expiresAt: Date.now() + 3600000,
        baseUrl: base,
        appsUrl: apps,
        ...override,
      }),
    );
    await expect(capturedBrowserSession()).rejects.toThrow();
    expect(state.oracle).not.toHaveBeenCalled();
  },
);
it("refuses backend token rotation instead of silently switching identities", async () => {
  state.oracle.mockResolvedValue({ ...fixtureUser, token: "different-token" });
  await expect(capturedBrowserSession()).rejects.toMatchObject({
    code: "EXPIRED",
  });
});
it("does not create a session from HTTP-200 login business errors", async () => {
  state.oracle.mockResolvedValue({
    response_msg: "ERROR",
    response_message: "Unknown user",
  });
  await expect(capturedBrowserSession()).rejects.toThrow();
});
it.each([
  ["a raw token", "isolated-test-token", null],
  [
    "the VBCS cookie",
    JSON.stringify({
      token: "isolated-test-token",
      expiry_datetime: "2099-01-01T00:00:00Z",
    }),
    "2099-01-01T00:00:00Z",
  ],
  [
    "the URL-encoded VBCS cookie",
    encodeURIComponent(
      JSON.stringify({ token: "isolated-test-token", expiry_datetime: "" }),
    ),
    null,
  ],
])("reads %s pasted on the login page", (_, input, expiry) => {
  expect(parsePastedToken(`  ${input}\n`)).toEqual({
    token: "isolated-test-token",
    expiry,
  });
});
it.each(["", "   ", "{not json", '{"expiry_datetime":"x"}', "two words"])(
  "rejects the unusable paste %j",
  (input) => expect(parsePastedToken(input)).toBeNull(),
);
it("validates a pasted token without reading the capture file", async () => {
  const b = await pastedBrowserSession("isolated-test-token");
  expect(state.read).not.toHaveBeenCalled();
  expect(state.oracle).toHaveBeenCalledWith("getSessionValidate", {
    token: "isolated-test-token",
  });
  expect(b.expiresAt).toBeLessThanOrEqual(Date.now() + DEV_SESSION_LEASE_MS);
});
it("lets validate, not a stale cookie expiry, decide whether a pasted token lives", async () => {
  const stale = JSON.stringify({
    token: "isolated-test-token",
    expiry_datetime: new Date(Date.now() - 60000).toISOString(),
  });
  const b = await pastedBrowserSession(stale);
  expect(b.backendExpiresAt).toBeGreaterThan(Date.now());
});
it("refuses a pasted token that GrantsNow rejects or rotates", async () => {
  state.oracle.mockResolvedValueOnce({ response_msg: "ERROR" });
  await expect(pastedBrowserSession("isolated-test-token")).rejects.toThrow();
  state.oracle.mockResolvedValueOnce({ ...fixtureUser, token: "other" });
  await expect(
    pastedBrowserSession("isolated-test-token"),
  ).rejects.toMatchObject({ code: "EXPIRED" });
});
it("refuses a pasted token outside browser-session mode", async () => {
  vi.stubEnv("DEV_BROWSER_SESSION", "false");
  await expect(
    pastedBrowserSession("isolated-test-token"),
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).not.toHaveBeenCalled();
});
