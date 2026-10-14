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
