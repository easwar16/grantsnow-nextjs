"use client";
import { useCallback } from "react";
import { useToast } from "@/components/feedback/toast";
import { appStore } from "@/lib/app-store";
export type ActionError = { code: string; message: string; action?: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError };
const OFFLINE: ActionError = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
/** A card action through its same-origin route: a GET read without a body, a POST write with one. */
export async function callAction<T>(
  action: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<Result<T>> {
  const url = `/api/opportunities/actions/${action}${query ? `?${new URLSearchParams(query)}` : ""}`;
  try {
    const response = await fetch(
      url,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
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
// Dialog setups stay fresh briefly, so a hover's read serves the open without serving a stale setup much later.
const SETUP_TTL = 30_000;
const readKey = (action: string, query?: Record<string, string>) =>
  `action:${JSON.stringify([action, query ?? {}])}`;
const read =
  <T>(action: string, query?: Record<string, string>) =>
  () =>
    callAction<T>(action, undefined, query);
/** Starts a dialog's setup read in the app store on intent (hover, focus or a click before a confirm); a read only. */
export function warmRead(action: string, query?: Record<string, string>) {
  appStore()?.prefetch(readKey(action, query), read(action, query), SETUP_TTL);
}
/** The dialog's setup through the app store: the warmed or held read if fresh, otherwise a new one. */
export function takeRead<T>(action: string, query?: Record<string, string>) {
  const store = appStore();
  return (
    store
      ? store.load(readKey(action, query), read<T>(action, query), {
          ttl: SETUP_TTL,
        })
      : read<T>(action, query)()
  ) as Promise<Result<T>>;
}
/**
 * Reference lists several dialogs share (share recipients, a PI's org units), held in the app store for a few
 * minutes as VBCS holds its app-level lists; concurrent openers share one request.
 */
export function sharedRead<T>(action: string, query?: Record<string, string>) {
  const store = appStore();
  return (
    store
      ? store.load(readKey(action, query), read<T>(action, query), {
          ttl: 5 * 60_000,
        })
      : read<T>(action, query)()
  ) as Promise<Result<T>>;
}
/** A failed action as GN-Angular shows it: writes switched off are an info toast, anything else an error. */
export function useActionFailure() {
  const toast = useToast();
  return useCallback(
    (error: ActionError) =>
      error.code === "WRITES_DISABLED"
        ? toast.show("info", error.message)
        : toast.error(error),
    [toast],
  );
}
