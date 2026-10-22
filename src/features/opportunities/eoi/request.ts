"use client";
import type { ActionError } from "../components/actions/request";
type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError };
const OFFLINE: ActionError = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
/** A record write through its same-origin route: `path` is the page path under `/api` (e.g. `/opportunities/eoi/12/lock`). */
export async function postRecord<T = unknown>(
  path: string,
  body: unknown,
): Promise<Result<T>> {
  try {
    const response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return response.ok
      ? { ok: true, data: json as T }
      : { ok: false, error: json.error ?? OFFLINE };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
