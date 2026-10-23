import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({ read: vi.fn(), devBridge: true }));
vi.mock("@/server/oracle/connection", () => ({ oracle: state.read }));
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({ token: "t" }),
}));
vi.mock("@/server/platform/configuration/environment", () => ({
  browserSessionMode: () => state.devBridge,
}));
import { approvalActor } from "@/server/record/approvals/actor";
import { forget } from "@/server/oracle/cache";
import type { AppSession } from "@/shared/auth/types";
const session = (more: Partial<AppSession> = {}): AppSession => ({
  token: "t",
  expiresAt: Date.now() + 60_000,
  subject: "s",
  identityExpiresAt: Date.now() + 60_000,
  fixture: false,
  ...more,
});
const bridge = session({ source: "browser-session" });
beforeEach(() => {
  state.devBridge = true;
  state.read.mockReset();
  state.read.mockResolvedValue({
    items: [
      { person_id: 101, email_address: "someone.else@example.ac.uk" },
      { person_id: 5565, email_address: " dam.saurabh@example.ac.uk " },
      { person_id: 77, email_address: null },
    ],
  });
});
afterEach(() => vi.clearAllMocks());
it("uses the username verified at OIDC sign-in, without reading the person list", async () => {
  expect(
    await approvalActor(session({ username: "verified@example.ac.uk" }), {
      personId: "5565",
    }),
  ).toBe("verified@example.ac.uk");
  expect(state.read).not.toHaveBeenCalled();
});
it("on the DEV token bridge, acts as the validated person's email", async () => {
  expect(await approvalActor(bridge, { personId: "5565" })).toBe(
    "dam.saurabh@example.ac.uk",
  );
  expect(state.read.mock.calls[0][0]).toBe("getPre_awardGetPersonListAll");
});
it("fails closed: no such person, no email, outside the DEV bridge, or an unreadable list", async () => {
  expect(await approvalActor(bridge, { personId: "999" })).toBeNull();
  expect(await approvalActor(bridge, { personId: "77" })).toBeNull();
  // A session that is not the bridge never derives one, nor does the bridge outside development.
  expect(await approvalActor(session(), { personId: "5565" })).toBeNull();
  state.devBridge = false;
  expect(await approvalActor(bridge, { personId: "5565" })).toBeNull();
  state.devBridge = true;
  // The person list is held per session; drop it so the next read fails.
  forget("");
  state.read.mockRejectedValue(new AppError("UPSTREAM", "down"));
  expect(await approvalActor(bridge, { personId: "5565" })).toBeNull();
});
it("still sends an expired session to sign-in", async () => {
  state.read.mockRejectedValue(new AppError("EXPIRED", "gone", 401));
  await expect(
    approvalActor(bridge, { personId: "5565" }),
  ).rejects.toMatchObject({ code: "EXPIRED" });
});
