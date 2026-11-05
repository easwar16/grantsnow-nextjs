"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import styles from "./record-tabs.module.css";

/** One record page tab: a routed link, with its glyph and the finalized tick. */
export interface RecordTab {
  key: string;
  href: string;
  name: string;
  icon: IconName;
  finalized?: boolean;
  /** An id a module's tests already use; else `<id>-tab-<key>`. */
  id?: string;
}

/**
 * The record pages' tab bar, the same in every module: legacy getTabs' tabs as links, the current one marked
 * (`aria-current`), a tick on finalized pages; on small screens only the glyphs show. Its scrollbar is hidden (owner,
 * 2026-11-03): arrows show at an end with more tabs, the wheel scrolls it sideways, and the current tab is
 * brought into view.
 */
export function RecordTabs({
  id,
  label,
  tabs,
  current,
  finalizedLabel = "Finalized",
}: {
  id: string;
  label: string;
  tabs: RecordTab[];
  current: string | null;
  finalizedLabel?: string;
}) {
  const bar = useRef<HTMLElement>(null),
    // Which ends have more tabs past them (legacy oj-tab-bar's conveyor arrows).
    [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    bar.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  // React's onWheel is passive, so the page would scroll too; a native listener can take the gesture.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (
        el.scrollWidth <= el.clientWidth ||
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
      )
        return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    const measure = () =>
      setMore({
        start: el.scrollLeft > 1,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    measure();
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("scroll", measure);
    };
  }, [tabs.length]);
  const page = (direction: 1 | -1) =>
    bar.current?.scrollBy({
      left: direction * bar.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  if (tabs.length === 0) return null;
  return (
    <div className={styles.frame}>
      {more.start && (
        <button
          type="button"
          id={`${id}-previous`}
          className={styles.arrow}
          aria-label="Previous tabs"
          aria-controls={id}
          onClick={() => page(-1)}
        >
          <Icon name="chevron-left" size={16} />
        </button>
      )}
      <nav ref={bar} id={id} className={styles.tabs} aria-label={label}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            id={t.id ?? `${id.replace(/-tabs$/, "")}-tab-${t.key}`}
            href={t.href}
            prefetch={false}
            className={t.key === current ? styles.selected : undefined}
            aria-current={t.key === current ? "page" : undefined}
            title={t.name}
          >
            <Icon name={t.icon} size={16} />
            <span className={styles.name}>{t.name}</span>
            {t.finalized && (
              <Icon
                className={styles.finalized}
                name="success"
                size={14}
                label={finalizedLabel}
              />
            )}
          </Link>
        ))}
      </nav>
      {more.end && (
        <button
          type="button"
          id={`${id}-next`}
          className={styles.arrow}
          aria-label="Next tabs"
          aria-controls={id}
          onClick={() => page(1)}
        >
          <Icon name="chevron-right" size={16} />
        </button>
      )}
    </div>
  );
}
