"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./help-button.module.css";
/**
 * GN-Angular's More Info button: rendered only when there is a text (the RB key's `label_description`, sanitised
 * on the server), shown in a popup below the button (above when there is no room). Escape or an outside click closes it.
 */
export function HelpButton({
  html,
  label = "More Info",
}: {
  html?: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [above, setAbove] = useState(false),
    host = useRef<HTMLSpanElement>(null),
    id = useId();
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
    <span ref={host} className={styles.host}>
      <button
        type="button"
        className={styles.help}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <div
          id={id}
          className={`${styles.popup} ${above ? styles.above : ""} enter-pop`}
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
