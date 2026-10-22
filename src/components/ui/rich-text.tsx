"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/feedback/skeleton";
import styles from "./rich-text.module.css";
const Editor = dynamic(() => import("./rich-text-editor"), {
  ssr: false,
  loading: () => <Skeleton kind="lines" count={3} label="Loading editor" />,
});
/** Fetches Quill's chunk on intent (hover or focus on what opens an editor); the bundler shares it with `Editor`. */
export const preloadEditor = () => {
  import("./rich-text-editor").catch(() => {
    // The editor's own load retries and shows its failure.
  });
};
/**
 * A rich-text control (Quill 2, GN-Angular D41): HTML in and out, with the original's "Source code" view for editing
 * the raw HTML. Read-only shows the HTML without loading Quill; editable, Quill loads once the field scrolls into
 * view. `value` must be HTML sanitised on the server (or the user's own edit). `id` names the editor; the source
 * view's parts take `${id}-<part>`.
 */
export function RichText({
  value,
  onChange,
  onBlur,
  label,
  id,
  invalid = false,
  readOnly = false,
  disabled = false,
  texts = {},
}: {
  value: string | null;
  onChange: (html: string | null) => void;
  onBlur?: () => void;
  label: string;
  id?: string;
  invalid?: boolean;
  /** No editor at all: the HTML as text. */
  readOnly?: boolean;
  /** The editor stays but takes no input (a save in flight). */
  disabled?: boolean;
  texts?: { sourceCode?: string; cancel?: string; done?: string };
}) {
  const host = useRef<HTMLDivElement>(null),
    [inView, setInView] = useState(false),
    // The raw HTML while the source view is open; null when closed.
    [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    const el = host.current;
    if (readOnly || inView || !el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setInView(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [readOnly, inView]);
  const sourceLabel = texts.sourceCode ?? "Source code",
    part = (name: string) => (id ? `${id}-${name}` : undefined);
  if (readOnly)
    return (
      <div
        className={`${styles.host} ${styles.readOnly}`}
        id={id}
        aria-label={label}
        dangerouslySetInnerHTML={{ __html: value ?? "" }}
      />
    );
  return (
    <div
      ref={host}
      className={`${styles.host} ${invalid ? styles.invalid : ""}`}
    >
      {source === null ? (
        <>
          {inView ? (
            <Editor
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              label={label}
              id={id}
              invalid={invalid}
              disabled={disabled}
            />
          ) : (
            <Skeleton kind="lines" count={3} label="Loading editor" />
          )}
          <button
            id={part("source-open")}
            type="button"
            className={`gn-btn gn-btn--borderless ${styles.sourceButton}`}
            disabled={disabled}
            onClick={() => setSource(value ?? "")}
          >
            <Icon name="code" size={14} />
            {sourceLabel}
          </button>
        </>
      ) : (
        <>
          <textarea
            id={part("source")}
            className={`gn-control ${styles.source}`}
            rows={8}
            aria-label={sourceLabel}
            value={source}
            disabled={disabled}
            onChange={(e) => setSource(e.target.value)}
          />
          <div className={styles.sourceActions}>
            <button
              id={part("source-cancel")}
              type="button"
              className="gn-btn gn-btn--solid"
              onClick={() => setSource(null)}
            >
              {texts.cancel ?? "Cancel"}
            </button>
            <button
              id={part("source-done")}
              type="button"
              className="gn-btn gn-btn--primary"
              disabled={disabled}
              onClick={() => {
                onChange(source.trim() === "" ? null : source);
                setSource(null);
              }}
            >
              {texts.done ?? "Done"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
