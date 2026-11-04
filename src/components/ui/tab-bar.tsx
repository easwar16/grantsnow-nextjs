"use client";
import styles from "./tab-bar.module.css";

/**
 * An in-page tab bar (JET oj-tab-bar edge="top", centred): one tab stop, arrow keys / Home / End move and select.
 * The page renders the panel; it carries `${id}-panel-${key}` and is labelled by `${id}-tab-${key}`.
 */
export function TabBar<K extends string>({
  id,
  label,
  tabs,
  selected,
  onSelect,
  align = "center",
}: {
  id: string;
  label: string;
  tabs: { key: K; name: string }[];
  selected: K;
  onSelect: (key: K) => void;
  /** Legacy centres some bars in their container; a plain oj-tab-bar sits at the start. */
  align?: "center" | "start";
}) {
  const at = tabs.findIndex((t) => t.key === selected);
  return (
    <div
      id={id}
      role="tablist"
      aria-label={label}
      className={`${styles.bar} ${align === "start" ? styles.start : ""}`}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const last = tabs.length - 1;
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : (at + (e.key === "ArrowRight" ? 1 : last)) % tabs.length;
        onSelect(tabs[next].key);
        e.currentTarget
          .querySelectorAll<HTMLElement>('[role="tab"]')
          [next]?.focus();
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={`${id}-tab-${t.key}`}
          aria-selected={t.key === selected}
          aria-controls={`${id}-panel-${t.key}`}
          tabIndex={t.key === selected ? 0 : -1}
          onClick={() => onSelect(t.key)}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
