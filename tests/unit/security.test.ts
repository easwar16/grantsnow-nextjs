import { describe, it, expect, vi, afterEach } from "vitest";
import { trustedUsername, safeReturn, sameOrigin } from "@/lib/security";
import { fixtureMode } from "@/server/configuration/environment";
import { mapBootstrap, expiry } from "@/server/session/contracts";
import { LatestRequest } from "@/lib/latest-request";
import { assertBusiness } from "@/server/api/transport";
import {
  requireModule,
  requireRead,
  scopeOrganization,
} from "@/server/permissions/policy";
import { fixtureUser } from "@/test-support/fixtures";
afterEach(() => vi.unstubAllEnvs());
describe("trusted identity", () => {
  it("maps only the configured verified claim", () =>
    expect(
      trustedUsername(
        { sub: "idcs-123", preferred_username: "owner" },
        "preferred_username",
      ),
    ).toBe("owner"));
  it.each([
    { sub: "id" },
    { sub: "id", username: "" },
    { username: "owner" },
    { sub: "id", username: "evil\r\nusername:admin" },
  ])("rejects missing/unsafe identity %j", (claims) =>
    expect(() => trustedUsername(claims, "username")).toThrow(),
  );
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/api/auth/logout",
    "/proposals\n",
    "javascript:alert(1)",
  ])("rejects redirect %s", (value) => expect(safeReturn(value)).toBe("/home"));
  it("preserves only implemented internal routes", () =>
    expect(safeReturn("/proposals?search=climate")).toBe(
      "/proposals?search=climate",
    ));
  it("denies cross-origin POST", () =>
    expect(() =>
      sameOrigin(
        new Request("https://app/api/auth/logout", {
          headers: { origin: "https://evil" },
        }),
        "https://app",
      ),
    ).toThrow());
});
describe("session/bootstrap", () => {
  it("rejects business error within HTTP 200 despite a token", () =>
    expect(() =>
      mapBootstrap({
        ...fixtureUser,
        token: "invalid",
        expiry_datetime: new Date(Date.now() + 60000).toISOString(),
        response_msg: "ERROR",
      }),
    ).toThrow());
  it("rejects incomplete success", () =>
    expect(() => mapBootstrap({ token: "test" })).toThrow());
  it("maps valid bootstrap with explicit module access", () =>
    expect(
      mapBootstrap({
        ...fixtureUser,
        token: "test",
        expiry_datetime: new Date(Date.now() + 60000).toISOString(),
      }).user.modules.PROPOSALS,
    ).toBe(true));
  it("rejects ambiguous expiry", () =>
    expect(() => expiry("2026-10-13T12:00:00")).toThrow());
  it("rejects expired session", () =>
    expect(() => expiry("2001-01-01T00:00:00Z")).toThrow());
  it("treats business errors as failure, never an empty list", () =>
    expect(() =>
      assertBusiness({ items: [], error_code: "DENIED" }),
    ).toThrow());
});
describe("access policy", () => {
  const user = mapBootstrap({
    ...fixtureUser,
    token: "test",
    expiry_datetime: new Date(Date.now() + 60000).toISOString(),
  }).user;
  it("denies missing module access", () =>
    expect(() =>
      requireModule({ ...user, modules: {} }, "PROPOSALS"),
    ).toThrow());
  it("denies missing read configuration", () =>
    expect(() => requireRead([], "home")).toThrow());
  it("denies widening org filters", () =>
    expect(() =>
      scopeOrganization("admin-org", [{ id: "own-org" }]),
    ).toThrow());
  it("allows an organization returned by trusted service", () =>
    expect(scopeOrganization("own-org", [{ id: "own-org" }])).toBe("own-org"));
});
describe("development isolation", () => {
  it("prohibits production fixtures even for development marker", () =>
    expect(() =>
      fixtureMode({
        FIXTURE_MODE: "true",
        APP_ENV: "development",
        NODE_ENV: "production",
      }),
    ).toThrow());
  it("prohibits fixture mode in staging", () =>
    expect(() =>
      fixtureMode({
        FIXTURE_MODE: "true",
        APP_ENV: "staging",
        NODE_ENV: "development",
      }),
    ).toThrow());
  it("has no implicit fallback", () => expect(fixtureMode({})).toBe(false));
});
it("aborts and rejects out-of-order responses", () => {
  const latest = new LatestRequest(),
    a = latest.begin(),
    b = latest.begin();
  expect(a.signal.aborted).toBe(true);
  expect(a.current()).toBe(false);
  expect(b.current()).toBe(true);
  latest.cancel();
  expect(b.current()).toBe(false);
});
