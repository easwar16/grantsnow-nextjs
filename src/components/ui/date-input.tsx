"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useFormat } from "@/components/layout/shell-context";
import { dateDisplay, datePattern, parseDisplayDate } from "@/lib/format";
import styles from "./date-input.module.css";

/**
 * A date field in the configured global date format (getGlobalVar DEFAULT_DATE_FORMAT): the pattern is its
 * placeholder, typed text is read in that pattern on blur or Enter, and the calendar button opens the native picker.
 * The value stays ISO yyyy-mm-dd ("" for none), so callers' contracts do not change.
 */
export function DateInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  invalid,
  describedBy,
  onBlur,
  className,
}: {
  id: string;
  /** Its accessible name, unless a <label htmlFor={id}> names it. */
  label?: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
  className?: string;
}) {
  const format = useFormat();
  const shown = (iso: string) => (iso ? dateDisplay(iso, format) : "");
  const [text, setText] = useState(() => shown(value)),
    [synced, setSynced] = useState(value),
    [bad, setBad] = useState(false),
    picker = useRef<HTMLInputElement>(null);
  // A new value from outside (a picker, Clear, a reload) replaces whatever was typed.
  if (value !== synced) {
    setSynced(value);
    setText(shown(value));
    setBad(false);
  }
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  function commit() {
    if (text.trim() === "") {
      setBad(false);
      if (value !== "") onChange("");
      return;
    }
    const iso = parseDisplayDate(text, format);
    if (!iso || !inRange(iso)) return setBad(true);
    setBad(false);
    setText(shown(iso));
    if (iso !== value) onChange(iso);
  }
  return (
    <span className={`${styles.field} ${className ?? ""}`}>
      <input
        id={id}
        className="gn-control"
        type="text"
        inputMode="text"
        autoComplete="off"
        aria-label={label}
        aria-invalid={bad || invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        placeholder={datePattern(format)}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          commit();
          onBlur?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <button
        id={`${id}-picker`}
        type="button"
        className={styles.button}
        aria-label={`Choose ${label ?? "date"}`}
        disabled={disabled}
        onClick={() => picker.current?.showPicker()}
      >
        <Icon name="calendar" size={14} />
      </button>
      {/* The native picker, opened by the button; it stays out of the tab order and the accessibility tree. */}
      <input
        ref={picker}
        id={`${id}-picker`}
        className={styles.picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
