"use client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The app store: data the browser has loaded once, shared by every component and page that needs it, as VBCS holds
 * `$application.variables`. It holds only the allowlisted display models our API routes return. TanStack Query does
 * the work: one request per key in flight, latest wins (a forgotten request never lands), held data shown at once
 * while a fresh copy loads, and `ttl` as how long data counts as fresh. This file keeps the app's small API over it.
 */
export type StoreError = {
  code: string;
  message: string;
  action?: string;
  /** The route's HTTP status, where a caller acts on it (an already-deleted file is a 404). */
  status?: number;
};
export type StoreResult<T> =
  { ok: true; data: T } | { ok: false; error: StoreError };
type Loader<T> = () => Promise<StoreResult<T>>;

/** A failed result as the query's error, so TanStack keeps the last good data beside it and never reuses it. */
export class ResultError extends Error {
  constructor(readonly error: StoreError) {
    super(error.message);
  }
}
const OFFLINE: StoreError = {
  code: "UPSTREAM",
  message: "This request could not be completed.",
};
export const errorOf = (e: unknown): StoreError =>
  e instanceof ResultError ? e.error : OFFLINE;
export async function unwrap<T>(result: Promise<StoreResult<T>>) {
  const r = await result;
  if (!r.ok) throw new ResultError(r.error);
  return r.data;
}
const keyOf = (key: string) => [key];

export type StoreApi = {
  /** The entry's result: fresh data at once, otherwise the shared in-flight request or a new one. */
  load<T>(
    key: string,
    loader: Loader<T>,
    options?: { ttl?: number; force?: boolean },
  ): Promise<StoreResult<T>>;
  /** Starts a read on intent (hover, focus) without waiting for it; reads only. */
  prefetch<T>(key: string, loader: Loader<T>, ttl?: number): void;
  /** Replaces an entry's data after a write the client already knows the result of (it counts as fresh). */
  patch(key: string, data: unknown): void;
  /** Drops entries whose key starts with `prefix`; an answer still in flight for them is discarded. */
  forget(prefix: string): void;
  /** Rewrites the held data of every entry whose key starts with `prefix` (a saved change shown wherever it is held). */
  update<T>(prefix: string, change: (data: T) => T): void;
};
/** The store's API over one QueryClient. */
export function createStoreApi(client: QueryClient): StoreApi {
  return {
    async load(key, loader, { ttl = 0, force = false } = {}) {
      try {
        const data = await client.query({
          queryKey: keyOf(key),
          queryFn: () => unwrap(loader()),
          staleTime: force ? 0 : ttl,
        });
        return { ok: true, data };
      } catch (e) {
        return { ok: false, error: errorOf(e) };
      }
    },
    prefetch(key, loader, ttl = 0) {
      // A prefetch only warms the store; its failure is the reader's to show.
      client
        .query({
          queryKey: keyOf(key),
          queryFn: () => unwrap(loader()),
          staleTime: ttl,
        })
        .catch(() => undefined);
    },
    patch(key, data) {
      void client.cancelQueries({ queryKey: keyOf(key) });
      client.setQueryData(keyOf(key), data);
    },
    forget(prefix) {
      const predicate = (q: { queryKey: readonly unknown[] }) =>
        String(q.queryKey[0]).startsWith(prefix);
      void client.cancelQueries({ predicate });
      client.removeQueries({ predicate });
    },
    update<T>(prefix: string, change: (data: T) => T) {
      client.setQueriesData<T>(
        {
          predicate: (q) => String(q.queryKey[0]).startsWith(prefix),
        },
        (data) => (data === undefined ? data : change(data)),
      );
    },
  };
}
/** The app's QueryClient defaults: no automatic retries (the server already retries a timed-out connect, and a
 * refusal must not be repeated), and no refetch on window focus (the live app never re-reads on focus). */
export function newQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 0,
        // Held data stays for a revisit within half an hour, as the old store kept it.
        gcTime: 30 * 60_000,
      },
    },
  });
}

// The one store of this page, for module-level helpers (hover prefetches) that run outside a component's render.
let registered: StoreApi | null = null;
/** The mounted store's API, or null outside the authenticated shell. */
export const appStore = () => registered;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [client] = useState(newQueryClient);
  useEffect(() => {
    const api = createStoreApi(client);
    registered = api;
    return () => {
      if (registered === api) registered = null;
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function useStoreApi() {
  const client = useQueryClient();
  // One stable API per client: components list it in effect dependencies.
  return useMemo(() => createStoreApi(client), [client]);
}

/**
 * Reads `key` through the store: shows the held data at once, loads (or shares the load) when it is missing or
 * older than `ttl`, and re-runs when the key changes. `null` reads nothing.
 */
export function useStoreRead<T>(
  key: string | null,
  loader: Loader<T>,
  { ttl = 0 }: { ttl?: number } = {},
) {
  const query = useQuery({
    queryKey: keyOf(key ?? ""),
    queryFn: () => unwrap(loader()),
    enabled: key !== null,
    staleTime: ttl,
  });
  return {
    data: query.data as T | undefined,
    error: query.error ? errorOf(query.error) : undefined,
    loading: key === null || query.isPending || query.isFetching,
    reload: async () => {
      await query.refetch();
    },
  };
}
