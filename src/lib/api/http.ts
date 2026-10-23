"use client";
import type { StoreError, StoreResult } from "@/lib/store/app-store";

/**
 * The browser's one connection to this app's own API routes (never Oracle: the server holds every token). Each call
 * answers a result instead of throwing: the body on success, the route's public error otherwise.
 */
export type ApiResult<T> = StoreResult<T>;
export type ApiError = StoreError;
export const OFFLINE: ApiError = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
/** Whether a result failed because the request never got an answer (network, abort), not because a route refused it. */
export const isOffline = (r: ApiResult<unknown>) =>
  !r.ok && r.error === OFFLINE;
type Query = Record<string, string | number | boolean | null | undefined>;
/** `/api` + path, with the query's set values in a stable order (so the same parameters make the same URL). */
export function apiUrl(path: string, query: Query = {}) {
  const q = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return `/api${path}${q ? `?${q}` : ""}`;
}
export async function call<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      signal,
      ...(body === undefined
        ? {}
        : body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    return response.ok
      ? { ok: true, data: json as T }
      : {
          ok: false,
          // A route's own error carries its status; a reply without one counts as no answer (isOffline).
          error: (json as { error?: ApiError }).error
            ? {
                ...(json as { error: ApiError }).error,
                status: response.status,
              }
            : OFFLINE,
        };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
export const get = <T>(path: string, query?: Query, signal?: AbortSignal) =>
  call<T>("GET", apiUrl(path, query), undefined, signal);
export const post = <T>(path: string, body?: unknown, query?: Query) =>
  call<T>("POST", apiUrl(path, query), body);
export const put = <T>(path: string, body?: unknown, query?: Query) =>
  call<T>("PUT", apiUrl(path, query), body);
export const del = <T>(path: string, query?: Query, body?: unknown) =>
  call<T>("DELETE", apiUrl(path, query), body);
