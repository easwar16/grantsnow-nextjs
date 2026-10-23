import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { forget, memo } from "@/server/oracle/cache";
beforeEach(() => {
  vi.useFakeTimers();
  forget("");
});
afterEach(() => vi.useRealTimers());
it("answers a stale figure at once while one background read refreshes it", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce("first")
    .mockResolvedValueOnce("second");
  const read = () => memo("k", 1000, load, { staleMs: 5000 });
  expect(await read()).toBe("first");
  vi.advanceTimersByTime(1500);
  // Stale: two callers at once both get the held value, and exactly one refresh starts.
  const [a, b] = [read(), read()];
  expect(load).toHaveBeenCalledTimes(2);
  expect([await a, await b]).toEqual(["first", "first"]);
  // The refresh has settled (its promise resolved before the awaits above): the next read has the new value.
  expect(await read()).toBe("second");
});
it("never serves past the stale window, and keeps no failure", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce("old")
    .mockRejectedValueOnce(new Error("down"))
    .mockResolvedValueOnce("new");
  const read = () => memo("w", 1000, load, { staleMs: 2000 });
  expect(await read()).toBe("old");
  vi.advanceTimersByTime(4000);
  await expect(read()).rejects.toThrow("down");
  expect(await read()).toBe("new");
});
it("forgets by prefix", async () => {
  const load = vi.fn().mockResolvedValue("v");
  await memo("a|1", 60_000, load);
  await memo("b|1", 60_000, load);
  forget("a|");
  await memo("a|1", 60_000, load);
  await memo("b|1", 60_000, load);
  expect(load).toHaveBeenCalledTimes(3);
});
it("is one cache across module instances, so a route handler's write clears what pages hold", async () => {
  const load = vi.fn().mockResolvedValue("locked");
  await memo("lock|1", 60_000, load);
  vi.resetModules();
  const other = await import("@/server/oracle/cache");
  other.forget("lock|");
  await memo("lock|1", 60_000, load);
  expect(load).toHaveBeenCalledTimes(2);
});
