"use client";
import { useEffect, useState } from "react";
import { renewDelay } from "@/features/auth/session-schedule";
interface Failure {
  message: string;
  action?: string;
}
const GENERIC = "Your session could not be extended.";
function signIn(reason?: string) {
  const query = new URLSearchParams({
    returnTo: window.location.pathname + window.location.search,
  });
  if (reason) query.set("reason", reason);
  return `/login?${query}`;
}
/** D37: extends the GrantsNow token one minute before it expires, then again from the returned expiry. */
export function SessionKeepAlive() {
  const [failure, setFailure] = useState<Failure | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function request(method: "GET" | "POST") {
      const response = await fetch(
        method === "GET" ? "/api/auth/session" : "/api/auth/renew",
        { method, cache: "no-store", signal: controller.signal },
      );
      if (response.status === 401) {
        window.location.assign(signIn("EXPIRED"));
        return null;
      }
      const body = await response.json();
      if (!response.ok) {
        setFailure({
          message: body?.error?.message || GENERIC,
          action: body?.error?.action,
        });
        return null;
      }
      return body?.expiresAt as unknown;
    }
    function schedule(expiresAt: unknown, previous?: number) {
      const delay = renewDelay(expiresAt, Date.now(), previous);
      if (delay === null) return;
      timer = setTimeout(() => void renew(expiresAt as number), delay);
    }
    async function renew(previous: number) {
      try {
        const expiresAt = await request("POST");
        if (expiresAt !== null) schedule(expiresAt, previous);
      } catch {
        if (!controller.signal.aborted) setFailure({ message: GENERIC });
      }
    }
    request("GET").then(
      (expiresAt) => schedule(expiresAt),
      () => {
        if (!controller.signal.aborted) setFailure({ message: GENERIC });
      },
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  if (!failure) return null;
  return (
    <div className="notice" role="alert">
      <strong>{failure.message}</strong>
      {failure.action && <p>{failure.action}</p>}
      <a href={signIn()}>Sign in again</a>
    </div>
  );
}
