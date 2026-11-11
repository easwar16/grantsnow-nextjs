"use client";
import { useEffect, useState } from "react";
import styles from "./section-nav.module.css";

export interface NavSection {
  key: string;
  name: string;
  /** The id of the section it scrolls to. */
  target: string;
}

/**
 * Jump links over one scrolling page of sections (the Claims prototype's record panels, which replace nested tabs):
 * each link scrolls its section into view, and the section in view is marked current. Links, not tabs: every section
 * stays on the page.
 */
export function SectionNav({
  id,
  label,
  sections,
}: {
  id: string;
  label: string;
  sections: NavSection[];
}) {
  const [current, setCurrent] = useState(sections[0]?.key ?? "");
  const targets = sections.map((s) => s.target).join(" ");
  useEffect(() => {
    const nav = document.getElementById(id);
    const first = document.getElementById(sections[0]?.target ?? "");
    // The page's own scroller: the nearest scrolling ancestor (a side panel), else the window.
    let scroller: HTMLElement | null = first?.parentElement ?? null;
    while (
      scroller &&
      !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
    )
      scroller = scroller.parentElement;
    const target = scroller ?? window;
    const update = () => {
      const top = (nav?.getBoundingClientRect().bottom ?? 0) + 8;
      const atEnd = scroller
        ? scroller.scrollTop + scroller.clientHeight >=
          scroller.scrollHeight - 2
        : window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      // The last section whose top has passed under the links; at the end of the page, the last section.
      const passed = sections.filter(
        (s) =>
          (document.getElementById(s.target)?.getBoundingClientRect().top ??
            Infinity) <= top,
      );
      const next = atEnd ? sections.at(-1) : (passed.at(-1) ?? sections[0]);
      if (next) setCurrent(next.key);
    };
    target.addEventListener("scroll", update, { passive: true });
    return () => target.removeEventListener("scroll", update);
    // The targets' ids are the dependency; `sections` is a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, targets]);
  const jump = (s: NavSection) => {
    setCurrent(s.key);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(s.target)
      ?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav id={id} className={styles.nav} aria-label={label}>
      {sections.map((s) => (
        <a
          key={s.key}
          id={`${id}-${s.key}`}
          href={`#${s.target}`}
          aria-current={s.key === current ? "location" : undefined}
          onClick={(e) => {
            e.preventDefault();
            jump(s);
          }}
        >
          {s.name}
        </a>
      ))}
    </nav>
  );
}
