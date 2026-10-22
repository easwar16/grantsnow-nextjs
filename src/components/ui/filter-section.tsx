"use client";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { idPart } from "@/lib/ids";
import styles from "./filter-section.module.css";

/** One listing page's filter column contents (GN-Angular finder drawer): Clear on top, then the sections. */
export function FilterStack({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className={styles.stack}>
      {children}
    </div>
  );
}

/** The column's Clear button; every listing page puts it first. */
export function FilterClear({
  id,
  label,
  onClick,
}: {
  id: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      className={`gn-btn gn-btn--solid ${styles.clear}`}
      onClick={onClick}
    >
      <Icon name="reset-filters" size={14} />
      {label}
    </button>
  );
}

/** A collapsible filter group: a 27px bold heading with a chevron, sliding open and closed (.gn-collapsible). */
export function FilterSection({
  id,
  title,
  open,
  onToggle,
  action,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** A small control in the heading, e.g. the funder tree's clear. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className={`gn-collapsible ${styles.section}`}
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next !== open) onToggle(next);
      }}
    >
      <summary id={`${id}-heading`}>
        <Icon className={styles.chevron} name="chevron-down" size={14} />
        {title}
        {action}
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}

/** A heading action button (stops the click from toggling the section). */
export function FilterSectionAction({
  id,
  label,
  icon,
  onClick,
}: {
  id: string;
  label: string;
  icon: "close-circle";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      className={styles.action}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

/** Ticks (several values) or radios (one value) in the same 27px rows. */
export function FilterChoices({
  id,
  label,
  type,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  type: "checkbox" | "radio";
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (value: string, checked: boolean) => void;
}) {
  return (
    <div id={id} className={styles.choices} role="group" aria-label={label}>
      {options.map((o) => (
        <label key={o.value}>
          <input
            id={`${id}-${idPart(o.value)}`}
            className={type === "checkbox" ? "gn-check" : undefined}
            type={type}
            name={type === "radio" ? id : undefined}
            checked={selected.includes(o.value)}
            onChange={(e) => onChange(o.value, e.target.checked)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** The date-sort select with its ascending / descending toggle. */
export function SortControl({
  id,
  label,
  options,
  value,
  dir,
  blank,
  onChange,
  onDirChange,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  dir: "ascending" | "descending";
  /** Offers an empty choice (no sort) first. */
  blank?: boolean;
  onChange: (value: string) => void;
  onDirChange: (dir: "ascending" | "descending") => void;
}) {
  const ascending = dir === "ascending";
  return (
    <div id={id} className={styles.sort}>
      <select
        id={`${id}-field`}
        className="gn-control"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {blank && <option value="" />}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        id={`${id}-direction`}
        className={styles.direction}
        aria-label={ascending ? "Ascending" : "Descending"}
        onClick={() => onDirChange(ascending ? "descending" : "ascending")}
      >
        <Icon
          name={ascending ? "arrow-circle-up" : "arrow-circle-down"}
          size={20}
        />
      </button>
    </div>
  );
}
