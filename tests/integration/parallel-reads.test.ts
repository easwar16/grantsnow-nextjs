import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ oracle: vi.fn(), token: "token-a" }));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: state.token },
    user: { personId: "12", modules: {} },
  }),
}));
vi.mock("@/server/oracle/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.oracle,
}));
vi.mock(
  "@/server/platform/configuration/environment",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    fixtureMode: () => false,
    oracleSettings: () => ({
      apps: new URL("https://oracle.example/ords/dev/"),
    }),
  }),
);
import { dashboardConfiguration } from "@/server/platform/configuration/service";
import { saveAccount } from "@/server/modules/account/service";
import { pagedRows, PAGE_CONCURRENCY } from "@/server/modules/home/paging";
let stored = "theme-default";
const preferenceReads = () =>
  state.oracle.mock.calls.filter(
    (c) => c[0] === "getSharedDashboardPreferences",
  ).length;
beforeEach(() => {
  state.token = "token-a";
  stored = "theme-default";
  state.oracle.mockReset();
  state.oracle.mockImplementation(async (op: string) =>
    op === "getSharedDashboardPreferences"
      ? { theme: stored, needAttention: {}, insights: {}, accessibility: {} }
      : { items: [] },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      stored = "theme-dark";
      return new Response("{}");
    }),
  );
  vi.stubEnv("WRITES_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("shares dashboard preferences between reads and reads them again after a save", async () => {
  const [a, b] = await Promise.all([
    dashboardConfiguration(),
    dashboardConfiguration(),
  ]);
  expect(a.theme).toBe("theme-default");
  // One shared read; each caller gets its own parse of the held body.
  expect(b).toEqual(a);
  expect(preferenceReads()).toBe(1);
  await saveAccount("dashboard", { theme: "theme-dark" });
  // The save read Oracle fresh for its merge, never the memo.
  expect(preferenceReads()).toBe(2);
  expect((await dashboardConfiguration()).theme).toBe("theme-dark");
  expect(preferenceReads()).toBe(3);
});
it("forgets the preferences even when the save fails", async () => {
  await dashboardConfiguration();
  vi.mocked(fetch).mockImplementation(async () => {
    stored = "theme-dark";
    return new Response("", { status: 500 });
  });
  await expect(
    saveAccount("dashboard", { theme: "theme-dark" }),
  ).rejects.toMatchObject({ code: "UPSTREAM" });
  expect((await dashboardConfiguration()).theme).toBe("theme-dark");
});
it("keys the memo by session, so one user's preferences never answer another's", async () => {
  await dashboardConfiguration();
  state.token = "token-b";
  stored = "theme-dark";
  expect((await dashboardConfiguration()).theme).toBe("theme-dark");
  state.token = "token-a";
  expect((await dashboardConfiguration()).theme).toBe("theme-default");
  expect(preferenceReads()).toBe(2);
});
it("never keeps a failed read", async () => {
  state.oracle.mockRejectedValueOnce(new Error("down"));
  await expect(dashboardConfiguration()).rejects.toThrow("down");
  expect((await dashboardConfiguration()).theme).toBe("theme-default");
});
/** A paged source of `total` rows; records each offset read and the most reads in flight at once. */
function source(total: number, count?: number) {
  const offsets: number[] = [];
  let inFlight = 0,
    most = 0;
  const read = async (offset: number) => {
    offsets.push(offset);
    most = Math.max(most, ++inFlight);
    // Later pages answer first, so order must come from the offsets, not arrival.
    await new Promise((r) => setTimeout(r, 20 - offset / 100));
    inFlight--;
    return {
      items: Array.from(
        { length: Math.max(0, Math.min(100, total - offset)) },
        (_, i) => offset + i,
      ),
      ...(count === undefined ? {} : { total_count: count }),
    };
  };
  return { read, offsets, most: () => most };
}
const tooMany = () => new Error("too many");
it("reads the pages after the first together once the total is known, keeping every row in order", async () => {
  const s = source(950, 950);
  const rows = await pagedRows(s.read, 100, () => {}, 10000, tooMany);
  expect(rows).toEqual(Array.from({ length: 950 }, (_, i) => i));
  expect(s.offsets[0]).toBe(0);
  expect([...s.offsets].sort((a, b) => a - b)).toEqual([
    0, 100, 200, 300, 400, 500, 600, 700, 800, 900,
  ]);
  expect(s.most()).toBe(PAGE_CONCURRENCY);
});
it("keeps reading one page at a time when the total undercounts or is missing", async () => {
  const stale = source(420, 200);
  expect(await pagedRows(stale.read, 100, () => {}, 10000, tooMany)).toEqual(
    Array.from({ length: 420 }, (_, i) => i),
  );
  expect(stale.offsets).toEqual([0, 100, 200, 300, 400]);
  const none = source(250);
  expect(await pagedRows(none.read, 100, () => {}, 10000, tooMany)).toEqual(
    Array.from({ length: 250 }, (_, i) => i),
  );
  expect(none.offsets).toEqual([0, 100, 200]);
  expect(none.most()).toBe(1);
});
it("fails a read that passes the cap or repeats a page, never returning part of it", async () => {
  await expect(
    pagedRows(source(5000, 5000).read, 100, () => {}, 1000, tooMany),
  ).rejects.toThrow("too many");
  const seen = new Set<number>();
  await expect(
    pagedRows(
      async () => ({ items: [1, 2], total_count: 4 }),
      2,
      (page) => {
        if (seen.has(page[0])) throw new Error("repeated");
        seen.add(page[0]);
      },
      100,
      tooMany,
    ),
  ).rejects.toThrow("repeated");
});
