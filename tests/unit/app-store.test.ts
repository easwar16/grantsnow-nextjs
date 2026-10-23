import { afterEach, expect, it, vi } from "vitest";
import {
  createStoreApi,
  newQueryClient,
  type StoreResult,
} from "@/lib/store/app-store";

// The store's API over a real QueryClient, configured as the app's provider configures it.
function harness() {
  const client = newQueryClient();
  return {
    api: createStoreApi(client),
    data: (key: string) => client.getQueryData([key]),
    state: (key: string) => client.getQueryState([key]),
    keys: () =>
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey[0]),
  };
}
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
afterEach(() => {
  vi.useRealTimers();
});

it("shares one in-flight request between concurrent readers of a key", async () => {
  const { api, data } = harness();
  const load = vi.fn(async (): Promise<StoreResult<string>> => ({
    ok: true,
    data: "funders",
  }));
  const [a, b] = await Promise.all([api.load("k", load), api.load("k", load)]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(a).toEqual(b);
  expect(data("k")).toBe("funders");
});

it("serves fresh data without a request, and reloads once it is older than ttl", async () => {
  vi.useFakeTimers();
  const { api } = harness();
  const load = vi.fn(async (): Promise<StoreResult<number>> => ({
    ok: true,
    data: 1,
  }));
  await api.load("k", load, { ttl: 1000 });
  await api.load("k", load, { ttl: 1000 });
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1001);
  await api.load("k", load, { ttl: 1000 });
  expect(load).toHaveBeenCalledTimes(2);
});

it("lets only the latest request settle a key: a forgotten slow answer never lands", async () => {
  const { api, data } = harness();
  const slow = deferred<StoreResult<string>>();
  void api.load("notes", () => slow.promise);
  api.forget("notes");
  await api.load("notes", async () => ({ ok: true, data: "new" }));
  slow.resolve({ ok: true, data: "old" });
  await slow.promise;
  await Promise.resolve();
  expect(data("notes")).toBe("new");
});

it("never reuses a failure, and keeps the last good data beside the error", async () => {
  const { api, data, state } = harness();
  await api.load("k", async () => ({ ok: true, data: "good" }));
  const failed = await api.load(
    "k",
    async () => ({
      ok: false,
      error: { code: "UPSTREAM", message: "down" },
    }),
    { force: true },
  );
  expect(failed).toEqual({
    ok: false,
    error: { code: "UPSTREAM", message: "down" },
  });
  expect(data("k")).toBe("good");
  const retry = vi.fn(async (): Promise<StoreResult<string>> => ({
    ok: true,
    data: "back",
  }));
  await api.load("k", retry, { force: true });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(state("k")?.error).toBeNull();
});

it("does not retry a failure on its own (a refusal must not be repeated)", async () => {
  const { api } = harness();
  const load = vi.fn(async (): Promise<StoreResult<never>> => ({
    ok: false,
    error: { code: "FORBIDDEN", message: "no" },
  }));
  await api.load("k", load);
  expect(load).toHaveBeenCalledTimes(1);
});

it("turns a thrown loader into a failure, and forget drops entries by prefix", async () => {
  const { api, keys } = harness();
  const result = await api.load("action:a", () =>
    Promise.reject(new Error("offline")),
  );
  expect(result.ok).toBe(false);
  await api.load("action:b", async () => ({ ok: true, data: 1 }));
  await api.load("other", async () => ({ ok: true, data: 2 }));
  api.forget("action:");
  expect(keys()).toEqual(["other"]);
});

it("patches an entry with what a write already returned, as fresh data", async () => {
  const { api, data } = harness();
  await api.load("bell", async () => ({ ok: true, data: { unread: 3 } }));
  api.patch("bell", { unread: 0 });
  expect(data("bell")).toEqual({ unread: 0 });
  const load = vi.fn(async (): Promise<StoreResult<unknown>> => ({
    ok: true,
    data: { unread: 9 },
  }));
  await api.load("bell", load, { ttl: 60_000 });
  expect(load).not.toHaveBeenCalled();
});

it("updates the held data of every entry under a prefix, and nothing else", async () => {
  const { api, data } = harness();
  await api.load("/api/opportunities?q=a", async () => ({
    ok: true,
    data: [1],
  }));
  await api.load("/api/opportunities?q=b", async () => ({
    ok: true,
    data: [2],
  }));
  await api.load("/api/opportunities/actions/share", async () => ({
    ok: true,
    data: [3],
  }));
  api.update<number[]>("/api/opportunities?", (rows) =>
    rows.map((n) => n * 10),
  );
  expect(data("/api/opportunities?q=a")).toEqual([10]);
  expect(data("/api/opportunities?q=b")).toEqual([20]);
  expect(data("/api/opportunities/actions/share")).toEqual([3]);
});
