"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./multi-select.module.css";
export interface MultiSelectOption {
  value: string;
  label: string;
}
/**
 * GN-Angular `gn-multi-select`, inside variant: a 45px box whose label floats above chips of the chosen values,
 * opening a searchable checkbox list. Escape or an outside click closes it.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    host = useRef<HTMLDivElement>(null),
    field = useRef<HTMLDivElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      field.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v,
    query = search.trim().toLowerCase(),
    filtered =
      query === ""
        ? options
        : options.filter((o) => o.label.toLowerCase().includes(query));
  const toggleOpen = () => {
    setSearch("");
    setOpen((o) => !o);
  };
  return (
    <div ref={host} className={`${styles.host} ${className ?? ""}`}>
      <div
        ref={field}
        className={styles.field}
        role="combobox"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) toggleOpen();
          }
        }}
      >
        {value.length === 0 ? (
          <span className={styles.placeholder}>{label}</span>
        ) : (
          <>
            <span className={styles.label}>{label}</span>
            <span className={styles.chips}>
              {value.map((v) => (
                <span key={v} className={styles.chip}>
                  {labelOf(v)}
                  {/* Pointer shortcut only; keyboard users untick the option in the list. */}
                  <button
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
            </span>
          </>
        )}
        <Icon className={styles.caret} name="chevron-down" size={12} />
      </div>
      {open && (
        <div id={id} className={`${styles.panel} enter-pop`}>
          <input
            ref={searchInput}
            className={styles.search}
            type="search"
            placeholder="Search"
            aria-label={`Search ${label}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul role="listbox" aria-multiselectable="true" aria-label={label}>
            {filtered.map((o) => (
              <li
                key={o.value}
                role="option"
                aria-selected={value.includes(o.value)}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={value.includes(o.value)}
                    onChange={() =>
                      onChange(
                        value.includes(o.value)
                          ? value.filter((v) => v !== o.value)
                          : [...value, o.value],
                      )
                    }
                  />
                  {o.label}
                </label>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className={styles.none}>No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
