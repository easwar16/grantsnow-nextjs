"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { usePresence } from "@/lib/use-presence";
import { useShellOptional } from "@/components/layout/shell-context";
import styles from "./help-button.module.css";
/**
 * GN-Angular's More Info button: rendered only when there is a text (the RB key's `label_description`, sanitised
 * on the server), shown in a popup below the button (above when there is no room). Escape or an outside click closes it.
 * `id` names the root; the button and popup take `${id}-button` and `${id}-popup`.
 */
export function HelpButton({
  id,
  html,
  label: given,
}: {
  id?: string;
  html?: string | null;
  /** Defaults to RB `dashboard` `button-labels.more_info`, as legacy's shell and Home buttons. */
  label?: string;
}) {
  const shell = useShellOptional();
  const label = given ?? shell?.labels.moreInfo ?? "More Info";
  const [open, setOpen] = useState(false),
    [above, setAbove] = useState(false),
    host = useRef<HTMLSpanElement>(null),
    autoId = useId(),
    popup = id ? `${id}-popup` : autoId;
  const presence = usePresence(open);
  useEffect(() => {
    if (!open) return;
    const rect = host.current?.getBoundingClientRect();
    setAbove(rect !== undefined && window.innerHeight - rect.bottom < 220);
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (html === null || html === undefined || html.trim() === "") return null;
  return (
    <span ref={host} id={id} className={styles.host}>
      <button
        id={id ? `${id}-button` : undefined}
        type="button"
        className={styles.help}
        aria-label={label}
        aria-expanded={open}
        aria-controls={popup}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="info" size={14} />
      </button>
      {presence.mounted && (
        <div
          id={popup}
          className={`${styles.popup} ${above ? styles.above : ""} ${presence.motion.className}`}
          inert={presence.leaving}
          onAnimationEnd={presence.motion.onAnimationEnd}
          role="dialog"
          aria-label={label}
        >
          <div className={styles.title}>{label}</div>
          <div
            className={styles.text}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </span>
  );
}
