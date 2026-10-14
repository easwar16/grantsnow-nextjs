"use client";
import { useRef, useState } from "react";
export function SessionControls() {
  const busy = useRef(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  async function renew() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/renew", { method: "POST" });
      const body = await response.json();
      setMessage(
        response.ok
          ? "Session extended."
          : body.error?.message || "Session could not be extended.",
      );
    } catch {
      setMessage("Session could not be extended. Please retry.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="session-controls">
      <button onClick={renew} disabled={pending}>
        {pending ? "Extending…" : "Extend session"}
      </button>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
      <span className="session-message" role="status">
        {message}
      </span>
    </div>
  );
}
