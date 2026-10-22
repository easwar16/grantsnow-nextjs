import { afterEach, expect, it, vi } from "vitest";
import {
  createStoreApi,
  storeReducer,
  type StoreResult,
} from "@/lib/app-store";

// The store without React: the reducer holds state, the API drives it as the provider does.
function harness() {
  let state: Parameters<typeof storeReducer>[0] = {};
  const api = createStoreApi((action) => {
    state = storeReducer(state, action);
  });
  return { api, state: () => state };
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
  const { api, state } = harness();
  const load = vi.fn(async (): Promise<StoreResult<string>> => ({
    ok: true,
    data: "funders",
  }));
  const [a, b] = await Promise.all([api.load("k", load), api.load("k", load)]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(a).toEqual(b);
  expect(state().k).toMatchObject({ data: "funders", loading: false });
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
  const { api, state } = harness();
  const slow = deferred<StoreResult<string>>();
  void api.load("notes", () => slow.promise);
  api.forget("notes");
  await api.load("notes", async () => ({ ok: true, data: "new" }));
  slow.resolve({ ok: true, data: "old" });
  await slow.promise;
  await Promise.resolve();
  expect(state().notes.data).toBe("new");
});

it("never reuses a failure, and keeps the last good data beside the error", async () => {
  const { api, state } = harness();
  await api.load("k", async () => ({ ok: true, data: "good" }));
  await api.load(
    "k",
    async () => ({
      ok: false,
      error: { code: "UPSTREAM", message: "down" },
    }),
    { force: true },
  );
  expect(state().k).toMatchObject({ data: "good", error: { message: "down" } });
  const retry = vi.fn(async (): Promise<StoreResult<string>> => ({
    ok: true,
    data: "back",
  }));
  await api.load("k", retry, { force: true });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(state().k.error).toBeUndefined();
});

it("turns a thrown loader into a failure, and forget drops entries by prefix", async () => {
  const { api, state } = harness();
  const result = await api.load("action:a", () =>
    Promise.reject(new Error("offline")),
  );
  expect(result.ok).toBe(false);
  await api.load("action:b", async () => ({ ok: true, data: 1 }));
  await api.load("other", async () => ({ ok: true, data: 2 }));
  api.forget("action:");
  expect(Object.keys(state())).toEqual(["other"]);
});

it("patches an entry with what a write already returned", async () => {
  const { api, state } = harness();
  await api.load("bell", async () => ({ ok: true, data: { unread: 3 } }));
  api.patch("bell", { unread: 0 });
  expect(state().bell.data).toEqual({ unread: 0 });
});
