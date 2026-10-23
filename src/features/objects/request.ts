"use client";
import { appStore } from "@/lib/app-store";
import type { ActionError } from "@/features/opportunities/components/actions/request";
type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError };
const OFFLINE: ActionError = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
/** Which record a panel belongs to: the host module and its record id, never identity or scope. */
export interface ObjectHost {
  host: string;
  record: string;
}
/** A shared panel's call to its same-origin route under `/api/objects`; a body makes it a JSON write. */
export async function objectCall<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  query: Record<string, string>,
  body?: unknown,
): Promise<Result<T>> {
  try {
    const response = await fetch(
      `/api/objects/${path}?${new URLSearchParams(query)}`,
      {
        method,
        cache: "no-store",
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
    );
    const json = await response.json();
    return response.ok
      ? { ok: true, data: json as T }
      : { ok: false, error: json.error ?? OFFLINE };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
// Held as VBCS holds its app-level person lists; concurrent openers share one request.
const PEOPLE_TTL = 5 * 60_000;
/** A reference read through the app store (the delegation picker's people). */
export function heldRead<T>(path: string, query: Record<string, string>) {
  const read = () => objectCall<T>("GET", path, query);
  const store = appStore();
  return (
    store
      ? store.load(`objects:${path}:${new URLSearchParams(query)}`, read, {
          ttl: PEOPLE_TTL,
        })
      : read()
  ) as Promise<Result<T>>;
}
