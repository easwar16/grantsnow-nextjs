import { afterEach, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppStoreProvider } from "@/lib/store/app-store";
import { usePagedApi, type PagedEndpoint } from "@/lib/api/hooks";
import type { ApiResult } from "@/lib/api/http";

// usePagedApi rendered under the app's store, with a server page still streaming as its seed.
const dom = new JSDOM("<!doctype html><div id=root></div>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
type Page = { rows: string[]; hasMore: boolean };
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
const endpoint = (
  loadPage: PagedEndpoint<string, string, Page>["loadPage"],
) => ({
  key: (p: string) => `/api/test?q=${p}`,
  loadPage,
  size: 10,
});
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});
async function mount(
  ep: PagedEndpoint<string, string, Page>,
  params: string,
  initial: Promise<ApiResult<Page>>,
) {
  const seen: {
    current?: ReturnType<typeof usePagedApi<string, string, Page>>;
  } = {};
  let setParams!: (p: string) => void;
  function Probe({ start }: { start: string }) {
    const [p, set] = useState(start);
    setParams = set;
    seen.current = usePagedApi(ep, p, { initial });
    return null;
  }
  root = createRoot(document.getElementById("root")!);
  await act(async () =>
    root!.render(
      createElement(
        AppStoreProvider,
        null,
        createElement(Probe, { start: params }),
      ),
    ),
  );
  return { seen, setParams: (p: string) => act(async () => setParams(p)) };
}
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

it("answers the first page from the streaming server read, without a request", async () => {
  const loadPage = vi.fn();
  const server = deferred<ApiResult<Page>>();
  const { seen } = await mount(endpoint(loadPage), "a", server.promise);
  expect(seen.current?.loading).toBe(true);
  await act(async () =>
    server.resolve({ ok: true, data: { rows: ["r1"], hasMore: false } }),
  );
  await settle();
  expect(seen.current?.rows).toEqual(["r1"]);
  expect(loadPage).not.toHaveBeenCalled();
});

it("shows a failed server read as the list's error, and Retry reads the route", async () => {
  const loadPage = vi.fn(async (): Promise<ApiResult<Page>> => ({
    ok: true,
    data: { rows: ["fresh"], hasMore: false },
  }));
  const failed = Promise.resolve<ApiResult<Page>>({
    ok: false,
    error: { code: "UPSTREAM", message: "down" },
  });
  const { seen } = await mount(endpoint(loadPage), "a", failed);
  await settle();
  expect(seen.current?.error?.message).toBe("down");
  expect(loadPage).not.toHaveBeenCalled();
  await act(async () => seen.current?.retry());
  await settle();
  expect(loadPage).toHaveBeenCalledTimes(1);
  expect(seen.current?.rows).toEqual(["fresh"]);
});

it("never lets the server's page answer other parameters", async () => {
  const loadPage = vi.fn(async (p: string): Promise<ApiResult<Page>> => ({
    ok: true,
    data: { rows: [`row-${p}`], hasMore: false },
  }));
  const server = deferred<ApiResult<Page>>();
  const { seen, setParams } = await mount(
    endpoint(loadPage),
    "a",
    server.promise,
  );
  await setParams("b");
  await settle();
  expect(loadPage).toHaveBeenCalledWith("b", 0);
  expect(seen.current?.rows).toEqual(["row-b"]);
});
