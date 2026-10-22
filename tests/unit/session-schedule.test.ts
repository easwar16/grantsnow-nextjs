import { expect, it } from "vitest";
import { RENEW_LEAD_MS, renewDelay } from "@/features/auth/session-schedule";
const now = 1_000_000;
it("extends one minute before expiry", () =>
  expect(renewDelay(now + 10 * 60000, now)).toBe(10 * 60000 - RENEW_LEAD_MS));
it("extends immediately when less than a minute remains", () =>
  expect(renewDelay(now + 1000, now)).toBe(0));
it("reschedules from a later returned expiry", () =>
  expect(renewDelay(now + 3600000, now, now + 60000)).toBe(
    3600000 - RENEW_LEAD_MS,
  ));
it.each([
  ["an unchanged expiry", now + 60000, now + 60000],
  ["an earlier expiry", now + 30000, now + 60000],
])("stops on %s (no loop)", (_, expiresAt, previous) =>
  expect(renewDelay(expiresAt, now, previous)).toBeNull(),
);
it.each([undefined, null, "2099-01-01", Number.NaN, now, now - 1])(
  "schedules nothing for the unusable expiry %j",
  (expiresAt) => expect(renewDelay(expiresAt, now)).toBeNull(),
);
