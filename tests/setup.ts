import { beforeEach, vi } from "vitest";
import { forget } from "@/server/oracle/cache";
// Each test starts with no memoised Oracle data, so one test's mocks never answer another's.
beforeEach(() => forget(""));
// The transport fetches through undici's pool; tests stub the global fetch, so undici's fetch defers to it.
vi.mock("undici", async (original) => ({
  ...(await original<typeof import("undici")>()),
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
