"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  clampWidth,
  keyWidth,
  maxWidth,
  PANEL_WIDTH,
  parseStoredWidth,
  storageKey,
} from "./filter-panel-width";
import styles from "./filter-panel.module.css";

function readWidth(page: string) {
  try {
    return parseStoredWidth(localStorage.getItem(storageKey(page)));
  } catch {
    return undefined; // Storage can be blocked; the default width still works.
  }
}

function writeWidth(page: string, width?: number) {
  try {
    if (width === undefined) localStorage.removeItem(storageKey(page));
    else localStorage.setItem(storageKey(page), String(width));
  } catch {
    // Not persisting is acceptable; the width still applies for this view.
  }
}

/**
 * A listing page's left filter column with a user-resizable width, beside its own scrolling results.
 * `page` keys the stored width; `id` names the collapsible filter body.
 */
export function FilterPanel({
  id,
  label,
  page,
  filters,
  children,
}: {
  id: string;
  label: string;
  page: string;
  filters: ReactNode;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; width: number }>(undefined);
  const [width, setWidth] = useState(PANEL_WIDTH.initial),
    [limit, setLimit] = useState(PANEL_WIDTH.max),
    [open, setOpen] = useState(true);
  const shown = Math.min(width, limit);
  // A layout effect applies the stored width before the browser paints a client navigation.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const stored = readWidth(page);
    if (stored !== undefined) setWidth(clampWidth(stored, element.clientWidth));
    const observer = new ResizeObserver(() =>
      setLimit(maxWidth(element.clientWidth)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [page]);
  const container = () => root.current?.clientWidth ?? window.innerWidth;
  function commit(next: number) {
    setWidth(next);
    writeWidth(page, next);
  }
  return (
    <div
      ref={root}
      className={styles.layout}
      style={{ "--filter-panel-width": `${shown}px` } as React.CSSProperties}
    >
      <aside className={styles.panel} data-open={open} aria-label={label}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            Filters <span aria-hidden="true">{open ? "«" : "»"}</span>
          </button>
        </div>
        <div id={id} className={styles.body} hidden={!open}>
          {filters}
        </div>
      </aside>
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label}`}
          aria-controls={id}
          aria-valuenow={shown}
          aria-valuemin={PANEL_WIDTH.min}
          aria-valuemax={limit}
          tabIndex={0}
          className={styles.handle}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault(); // Stops text selection while dragging.
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, width: shown };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setWidth(
              clampWidth(
                drag.current.width + event.clientX - drag.current.x,
                container(),
              ),
            );
          }}
          onLostPointerCapture={() => {
            if (!drag.current) return;
            drag.current = undefined;
            writeWidth(page, shown);
          }}
          onKeyDown={(event) => {
            const next = keyWidth(event.key, shown, container());
            if (next === undefined) return;
            event.preventDefault();
            commit(next);
          }}
          onDoubleClick={() => {
            setWidth(PANEL_WIDTH.initial);
            writeWidth(page, undefined);
          }}
        />
      )}
      <div className={styles.results}>{children}</div>
    </div>
  );
}
