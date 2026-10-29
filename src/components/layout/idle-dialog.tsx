"use client";
import { clearTabState } from "@/lib/tab-state";
import { useEffect, useRef } from "react";
import { useShell } from "./shell-context";
import styles from "./idle-dialog.module.css";
import { constants } from "@/lib/constants";
// The original signs out after 30 minutes without mouse, keyboard or scroll activity.
const ACTIVITY = ["mousemove", "click", "scroll", "keypress"] as const;
/**
 * GN-Angular SessionDialog: after 30 idle minutes a dialog with no way to close it; Login drops the session
 * (POST /api/auth/logout, as the original invalidates it) and the user signs in again.
 */
export function IdleDialog() {
  const { labels } = useShell();
  const dialog = useRef<HTMLDialogElement>(null),
    expired = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const restart = () => {
      if (expired.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        expired.current = true;
        dialog.current?.showModal();
      }, constants.timing.idleMs);
    };
    // Capture, so scrolling inside <main> (the one scroll container) counts as activity too.
    for (const name of ACTIVITY)
      document.addEventListener(name, restart, {
        capture: true,
        passive: true,
      });
    restart();
    return () => {
      clearTimeout(timer);
      for (const name of ACTIVITY)
        document.removeEventListener(name, restart, { capture: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      id="idle-dialog"
      className={styles.dialog}
      aria-labelledby="idle-title"
      onCancel={(e) => e.preventDefault()}
      // Browsers may still close on a repeated Escape; an expired session keeps the dialog up.
      onClose={() => {
        if (expired.current) dialog.current?.showModal();
      }}
    >
      <h2 id="idle-title">{labels.warning}</h2>
      <p>{labels.sessionExpired}</p>
      <form
        id="idle-dialog-form"
        action="/api/auth/logout"
        method="post"
        onSubmit={clearTabState}
        className={styles.foot}
      >
        <button id="idle-dialog-login" type="submit" className="primary">
          {labels.login}
        </button>
      </form>
    </dialog>
  );
}
