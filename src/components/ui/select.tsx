"use client";
import { idPart } from "@/lib/ids";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { highlight } from "@/components/ui/highlight";
import { usePresence } from "@/lib/use-presence";
import { useAnchor } from "@/lib/use-anchor";
import styles from "./select.module.css";
// Rows rendered at once (GN-Angular gn-select); the rest are reached by typing, so a long list opens instantly.
const SHOWN = 200;
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * GN-Angular `gn-select` as one combobox: the field shows the choice and is also where you type to narrow the list,
 * so the panel holds only options and opening it never adds a row to the form. Arrow keys move, Enter picks,
 * Escape or an outside click closes and restores the choice; "None" clears it. `id` names the root; its parts
 * take `${id}-<part>` (the field is `${id}-trigger`).
 */
export function Select({
  id,
  label,
  options,
  value,
  onChange,
  emptyText = "No options available",
  disabled = false,
  invalid = false,
}: {
  id?: string;
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (next: string) => void;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false),
    // null while not typing: the field then shows the chosen label and the list is unfiltered.
    [query, setQuery] = useState<string | null>(null),
    [active, setActive] = useState(0),
    host = useRef<HTMLDivElement>(null),
    box = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    list = useRef<HTMLUListElement>(null),
    autoId = useId(),
    base = id ?? autoId,
    panel = `${base}-panel`;
  const popup = usePresence(open);
  const placement = useAnchor(popup.mounted, box, 280);
  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const chosen = options.find((o) => o.value === value)?.label ?? value,
    needle = (query ?? "").trim().toLowerCase(),
    matches = useMemo(
      () =>
        needle === ""
          ? options
          : options.filter((o) => o.label.toLowerCase().includes(needle)),
      // Long people and funder lists: arrow keys re-render without filtering again.
      [options, needle],
    ),
    // "None" leads the list while something is chosen and nothing is typed.
    rows = [
      ...(value !== "" && needle === "" ? [{ value: "", label: "None" }] : []),
      ...matches.slice(0, SHOWN),
    ],
    current = Math.min(active, rows.length - 1),
    optionId = (v: string) => `${base}-option-${v === "" ? "none" : idPart(v)}`;
  useEffect(() => {
    if (!open || current < 0) return;
    list.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, current]);
  const pick = (next: string) => {
    close();
    if (next !== value) onChange(next);
  };
  const openList = () => {
    setActive(0);
    setOpen(true);
  };
  return (
    <div ref={host} id={id} className={styles.host}>
      <div
        ref={box}
        className={styles.field}
        data-part="field"
        data-open={open || undefined}
        data-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return;
          // A click while typing places the caret; otherwise it toggles the list.
          if (open && query === null) return close();
          if (open) return;
          openList();
          input.current?.focus();
          input.current?.select();
        }}
      >
        <input
          ref={input}
          id={`${base}-trigger`}
          className={styles.input}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={panel}
          aria-activedescendant={
            open && current >= 0 ? optionId(rows[current].value) : undefined
          }
          title={chosen || undefined}
          value={query ?? chosen}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={(e) => {
            if (!host.current?.contains(e.relatedTarget as Node)) close();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) return openList();
              const step = e.key === "ArrowDown" ? 1 : -1;
              setActive(Math.max(0, Math.min(rows.length - 1, current + step)));
            } else if (e.key === "Enter" && open && current >= 0) {
              e.preventDefault();
              pick(rows[current].value);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              // preventDefault marks it handled: a popup the field sits in leaves it alone.
              close();
            }
          }}
        />
        <Icon className={styles.caret} name="chevron-down" size={12} />
      </div>
      {popup.mounted && (
        <div
          id={panel}
          className={`${styles.panel} ${popup.motion.className}`}
          style={placement}
          inert={popup.leaving}
          onAnimationEnd={popup.motion.onAnimationEnd}
        >
          <ul ref={list} id={`${base}-list`} role="listbox" aria-label={label}>
            {rows.map((o, i) => (
              <li
                key={o.value || "none"}
                id={optionId(o.value)}
                role="option"
                data-index={i}
                aria-selected={o.value === value && o.value !== ""}
                data-active={i === current || undefined}
                // Pick on press so the field keeps focus (no blur-then-close race).
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.value);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {highlight(o.label, needle)}
              </li>
            ))}
            {rows.length === 0 && (
              <li className={styles.none}>
                {options.length ? "No matches" : emptyText}
              </li>
            )}
            {matches.length > SHOWN && (
              <li className={styles.none}>
                {matches.length - SHOWN} more; type to narrow
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
