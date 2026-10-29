"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { expand } from "@/lib/motion";
import styles from "./filter-section.module.css";
import { functions } from "@/lib/functions";

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

/** A collapsible filter group: a 27px bold heading with a chevron, its body sliding open and closed. */
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
  // The <details> stays open until its body has slid shut.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  return (
    <details
      id={id}
      className={styles.section}
      open={shown}
      data-open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next !== shown) onToggle(next);
      }}
    >
      <summary
        id={`${id}-heading`}
        onClick={(e) => {
          // The state toggles, not the browser, so closing can animate first.
          e.preventDefault();
          onToggle(!open);
        }}
      >
        <Icon className={styles.chevron} name="chevron-down" size={14} />
        {title}
        {action}
      </summary>
      <AnimatePresence initial={false} onExitComplete={() => setShown(false)}>
        {open && (
          <motion.div {...expand} id={`${id}-panel`} className={styles.panel}>
            <div className={styles.body}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
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
            id={`${id}-${functions.ids.idPart(o.value)}`}
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
      <Select
        id={`${id}-field`}
        className={styles.sortField}
        label={label}
        options={options}
        value={value}
        clearable={!!blank}
        onChange={onChange}
      />
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
