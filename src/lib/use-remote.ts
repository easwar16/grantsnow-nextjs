"use client";
import { useStoreRead, type StoreResult } from "./app-store";

const FAILED = {
  code: "UPSTREAM",
  message: "This request could not be completed.",
};

/** One same-origin GET as a store result: the body on success, the route's public error otherwise. */
export async function getJson<T>(url: string): Promise<StoreResult<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json();
    return response.ok
      ? { ok: true, data: body as T }
      : {
          ok: false,
          error: body.error || { ...FAILED, message: "This request failed." },
        };
  } catch {
    return { ok: false, error: FAILED };
  }
}

/**
 * A GET read through the app store, keyed by its URL: every component reading the same URL shares one request and
 * one answer, held data shows at once on a revisit while a fresh copy loads, and `retry` forces a new read.
 * `ttl` (ms) skips the refresh while the held data is younger than it.
 */
export function useRemote<T>(url: string | undefined, { ttl = 0 } = {}) {
  const { data, error, reload } = useStoreRead<T>(
    url ?? null,
    () => getJson<T>(url!),
    { ttl },
  );
  return {
    data,
    // A held error only counts while there is no data to show (a failed refresh keeps the last good data).
    error: data === undefined ? error : undefined,
    retry: () => void reload(),
  };
}
