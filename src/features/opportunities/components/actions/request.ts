"use client";
import { useCallback } from "react";
import { useToast } from "@/components/feedback/toast";
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
