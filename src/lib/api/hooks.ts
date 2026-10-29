"use client";
import { useRef } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import {
  errorOf,
  unwrap,
  useStoreApi,
  useStoreRead,
} from "@/lib/store/app-store";
import { apiUrl, get, type ApiResult } from "./http";

/**
 * Browser reads through the app store, keyed by the endpoint and its parameters (like a Redux selector): the same
 * parameters answer from the store, a changed one loads, and every component asking for the same data shares one
 * request. `ttl` (ms) is how long held data counts as fresh before a revisit refreshes it in the background.
 */
type Query = Parameters<typeof apiUrl>[1];
export interface Endpoint<P, T> {
  key(params: P): string;
  load(params: P): Promise<ApiResult<T>>;
  ttl?: number;
}
/** A GET route as an endpoint: `build` maps the parameters to its path and query. */
export function endpoint<P, T>(
  build: (params: P) => { path: string; query?: Query },
  options: { ttl?: number } = {},
): Endpoint<P, T> {
  return {
    key: (p) => {
      const b = build(p);
      return apiUrl(b.path, b.query);
    },
    load: (p) => {
      const b = build(p);
      return get<T>(b.path, b.query);
    },
    ttl: options.ttl,
  };
}
/** One page as the list holds it; `total` is the API's own count where the route reports one. */
export type ListPage<Row> = { rows: Row[]; hasMore: boolean; total?: number };
export interface PagedEndpoint<
  P,
  Row,
  Page extends ListPage<Row> = ListPage<Row>,
> {
  key(params: P): string;
  loadPage(params: P, offset: number): Promise<ApiResult<Page>>;
  size: number;
  ttl?: number;
}
/** A paged GET route: `page` maps one reply to its rows and whether another page follows. */
export function pagedEndpoint<P, Row, Body>(
  build: (params: P) => { path: string; query?: Query },
  page: (body: Body) => ListPage<Row>,
  options: { size?: number; ttl?: number } = {},
): PagedEndpoint<P, Row> {
  const size = options.size ?? 25;
  return {
    key: (p) => {
      const b = build(p);
      return apiUrl(b.path, b.query);
    },
    loadPage: async (p, offset) => {
      const b = build(p);
      const result = await get<Body>(b.path, {
        ...b.query,
        offset,
        limit: size,
      });
      return result.ok ? { ok: true, data: page(result.data) } : result;
    },
    size,
    ttl: options.ttl,
  };
}

/** One read: the held data at once, a load when it is missing or stale; `null` parameters read nothing. */
export function useApi<P, T>(ep: Endpoint<P, T>, params: P | null) {
  const key = params === null ? null : ep.key(params);
  const { data, error, loading, reload } = useStoreRead<T>(
    key,
    () => ep.load(params as P),
    { ttl: ep.ttl },
  );
  return {
    data,
    // A held error only counts while there is no data to show (a failed refresh keeps the last good data).
    error: data === undefined ? error : undefined,
    loading,
    retry: () => void reload(),
  };
}

/**
 * A paged list (TanStack's infinite query): pages are held under the parameters, `loadMore` appends the next page, and
 * a change in the parameters starts again from the first page (its own held pages show at once if they are fresh).
 * `start` is the first page's offset (a list opened at page 3 of the URL); `initial` is that page as the server already
 * rendered it, so it is not fetched again, or the server's read still streaming (a promise the page did not await),
 * which answers the first request for these parameters once; a retry or refresh reads the route.
 */
export function usePagedApi<P, Row, Page extends ListPage<Row> = ListPage<Row>>(
  ep: PagedEndpoint<P, Row, Page>,
  params: P | null,
  {
    start = 0,
    initial,
  }: { start?: number; initial?: Page | Promise<ApiResult<Page>> } = {},
) {
  const key = params === null ? "" : `${ep.key(params)}#start=${start}`;
  const streaming = initial && "then" in initial ? initial : undefined,
    held = streaming ? undefined : (initial as Page | undefined);
  // Bound to the parameters it was rendered for, so a changed filter never takes the server's page.
  const seed = useRef(streaming && params !== null ? { key, streaming } : null);
  const query = useInfiniteQuery({
    queryKey: [key],
    queryFn: ({ pageParam, queryKey }) => {
      const s = seed.current;
      seed.current = null;
      return unwrap(
        s && s.key === queryKey[0] && pageParam === start
          ? s.streaming
          : ep.loadPage(params as P, pageParam),
      );
    },
    enabled: params !== null,
    initialPageParam: start,
    getNextPageParam: (last: Page, all: Page[]) =>
      last.hasMore ? start + all.length * ep.size : undefined,
    ...(held
      ? {
          initialData: { pages: [held], pageParams: [start] },
          // The server's page is as fresh as one just loaded.
          staleTime: Math.max(ep.ttl ?? 0, 60_000),
        }
      : { staleTime: ep.ttl ?? 0 }),
    // New parameters keep the last list on screen until their first page arrives (`stale`), instead of blanking it.
    placeholderData: keepPreviousData,
  });
  const pages = query.data?.pages ?? [];
  return {
    rows: pages.flatMap((p) => p.rows),
    /** The newest page, for what a route reports beside its rows. */
    last: pages.at(-1),
    hasMore: query.hasNextPage,
    /** The rows shown are the previous parameters', kept while the new ones load. */
    stale: query.isPlaceholderData,
    // The most recent count the API reported (it can change while the list is open).
    total: [...pages].reverse().find((p) => p.total !== undefined)?.total,
    loading: params === null || query.isPending || query.isFetching,
    /** Only the next page is loading (a held list refreshing in the background is not). */
    loadingMore: query.isFetchingNextPage,
    error: query.error ? errorOf(query.error) : undefined,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
    },
    // A failed next page is asked again; refetch would only re-read the pages already held.
    retry: () =>
      void (query.isFetchNextPageError
        ? query.fetchNextPage()
        : query.refetch()),
    /** Reads the held pages again (after something changed them elsewhere). */
    reload: () => void query.refetch(),
  };
}
/** After a write: drops every held answer of an endpoint (all its parameters and pages). */
export function useForget() {
  const api = useStoreApi();
  return (path: string) => api.forget(`/api${path}`);
}
