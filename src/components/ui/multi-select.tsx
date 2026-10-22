"use client";
import { idPart } from "@/lib/ids";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { highlight } from "@/components/ui/highlight";
import { usePresence } from "@/lib/use-presence";
import { useAnchor } from "@/lib/use-anchor";
import styles from "./multi-select.module.css";
export interface MultiSelectOption {
  value: string;
  label: string;
  /** A second, quieter line (live's people list: org unit and employee number). */
  detail?: string;
}
/**
 * GN-Angular `gn-multi-select` as one combobox: the inside variant is a 45px box whose label floats above chips of
 * the chosen values; the control variant is one 28px line of the chosen labels and a count, for top-labelled forms.
 * You type in the field itself to narrow the checkbox list, so opening it never adds a row to the form. Arrow keys
 * move, Enter ticks or unticks, Backspace on an empty field drops the last chip, Escape or an outside click closes.
 * The chips variant has no label of its own, for an `InsideField` box (live's oj-select-many). `limit` caps the
 * rows drawn, with live's "More results available" note; `closeOnPick` closes the list after each pick, as live.
 * `id` names the root; its parts take `${id}-<part>` (the field is `${id}-field`).
 */
export function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
  className,
  variant = "inside",
  limit,
  closeOnPick = false,
  disabled = false,
}: {
  id?: string;
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  variant?: "inside" | "control" | "chips";
  limit?: number;
  closeOnPick?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    // null while not typing: the control variant then shows its summary and the list is unfiltered.
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
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v,
    summary = value.map(labelOf).join(", "),
    needle = (query ?? "").trim().toLowerCase(),
    matches = useMemo(
      () =>
        needle === ""
          ? options
          : options.filter((o) =>
              `${o.label} ${o.detail ?? ""}`.toLowerCase().includes(needle),
            ),
      // Long people and funder lists: arrow keys re-render without filtering again.
      [options, needle],
    ),
    rows = limit === undefined ? matches : matches.slice(0, limit),
    current = Math.min(active, rows.length - 1),
    optionId = (v: string) => `${base}-option-${idPart(v)}`;
  useEffect(() => {
    if (!open || current < 0) return;
    list.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, current]);
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    if (closeOnPick) close();
  };
  const openList = () => {
    setActive(0);
    setOpen(true);
  };
  const control = variant === "control",
    chips = variant === "chips";
  return (
    <div
      ref={host}
      id={id}
      className={`${styles.host} ${className ?? ""}`}
      data-variant={variant}
    >
      <div
        ref={box}
        className={styles.field}
        data-part="field"
        data-multi={chips || undefined}
        data-open={open || undefined}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return;
          // A click while typing places the caret; otherwise it toggles the list.
          if (open && query === null) return close();
          if (!open) openList();
          input.current?.focus();
        }}
      >
        {variant === "inside" && value.length > 0 && (
          <span className={styles.label}>{label}</span>
        )}
        <span className={styles.line}>
          {!control &&
            value.map((v) => (
              <span key={v} className={styles.chip}>
                {labelOf(v)}
                {/* Pointer shortcut only; keyboard users untick the option or press Backspace. */}
                <button
                  id={`${base}-remove-${idPart(v)}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelOf(v)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((x) => x !== v));
                  }}
                >
                  <Icon name="close" size={10} />
                </button>
              </span>
            ))}
          <input
            ref={input}
            id={`${base}-field`}
            className={styles.input}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={panel}
            aria-activedescendant={
              open && current >= 0 ? optionId(rows[current].value) : undefined
            }
            title={summary || undefined}
            disabled={disabled}
            placeholder={
              variant === "inside" && value.length === 0 ? label : undefined
            }
            value={query ?? (control ? summary : "")}
            onFocus={(e) => control && e.currentTarget.select()}
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
                setActive(
                  Math.max(0, Math.min(rows.length - 1, current + step)),
                );
              } else if (e.key === "Enter" && open && current >= 0) {
                e.preventDefault();
                toggle(rows[current].value);
              } else if (e.key === "Escape" && open) {
                e.preventDefault();
                // preventDefault marks it handled: a popup the field sits in leaves it alone.
                close();
              } else if (
                e.key === "Backspace" &&
                !control &&
                (query ?? "") === "" &&
                value.length > 0
              ) {
                onChange(value.slice(0, -1));
              }
            }}
          />
          {control && value.length > 1 && query === null && (
            <span className={styles.count}>{value.length}</span>
          )}
        </span>
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
          <ul
            ref={list}
            id={`${base}-list`}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
          >
            {matches.length > rows.length && (
              <li className={styles.note}>
                More results available, please filter further.
              </li>
            )}
            {rows.map((o, i) => (
              <li
                key={o.value}
                id={optionId(o.value)}
                role="option"
                data-index={i}
                aria-selected={value.includes(o.value)}
                data-active={i === current || undefined}
                // Toggle on press so the field keeps focus (and, unless it closes on pick, the list stays open).
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(o.value);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {!chips && (
                  <input
                    type="checkbox"
                    tabIndex={-1}
                    aria-hidden="true"
                    checked={value.includes(o.value)}
                    readOnly
                  />
                )}
                <span className={styles.text}>
                  <span>{highlight(o.label, needle)}</span>
                  {o.detail && (
                    <span className={styles.detail}>
                      {highlight(o.detail, needle)}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {rows.length === 0 && <li className={styles.none}>No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
