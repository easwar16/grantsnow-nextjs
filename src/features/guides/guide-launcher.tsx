"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { doneKey, guideMenu, guidesFor, loadSteps } from "./registry";
import type { Guide, GuideStep } from "./types";
import styles from "./guides.module.css";
import { functions } from "@/lib/functions";
type Tour = { destroy: () => void };
function isDone(g: Guide) {
  try {
    return localStorage.getItem(doneKey(g)) === "Y";
  } catch {
    return true; // Storage blocked: never auto-start on every visit.
  }
}
function markDone(g: Guide) {
  try {
    localStorage.setItem(doneKey(g), "Y");
  } catch {}
}
// driver.js renders under <body>, outside #app, so the live theme tokens are copied onto it.
const themeTokens = [
  "--gn-brand",
  "--gn-brand-deep",
  "--gn-on-brand",
  "--gn-surface",
  "--gn-text",
  "--gn-text-secondary",
  "--gn-divider",
  "--gn-font",
  "--gn-font-size",
  "--gn-radius",
];
function applyTheme(el: HTMLElement) {
  const app = document.getElementById("app");
  if (!app) return;
  const css = getComputedStyle(app);
  for (const t of themeTokens) el.style.setProperty(t, css.getPropertyValue(t));
}
const anchored = (s: GuideStep) => Boolean(s.target || s.selector);
function anchor(s: GuideStep): HTMLElement | null {
  if (s.target) return document.getElementById(s.target);
  return s.selector ? document.querySelector<HTMLElement>(s.selector) : null;
}
/** Selects a tab before a step; only `role="tab"` controls, so a guide never triggers an action. */
function openTab(id?: string) {
  const tab = id ? document.getElementById(id) : null;
  if (
    tab?.getAttribute("role") === "tab" &&
    tab.getAttribute("aria-selected") !== "true"
  )
    tab.click();
}
/** Resolves when `find` returns an element, or after a bounded wait. */
function appear(find: () => Element | null, ms: number) {
  return new Promise<void>((resolve) => {
    if (find()) return resolve();
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (find()) done();
    });
    const timer = setTimeout(done, ms);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
/** Opens a step's tab and waits for its element; false when the element never shows. */
async function reach(s: GuideStep) {
  openTab(s.open);
  if (!anchored(s)) return true;
  await appear(() => anchor(s), 3000);
  return anchor(s) !== null;
}
/** Starts a guide with driver.js; the library and its CSS load only on first use. */
async function run(g: Guide, content: GuideStep[]): Promise<Tour> {
  const [{ driver }] = await Promise.all([
    import("driver.js"),
    import("driver.js/dist/driver.css"),
  ]);
  // A step behind a tab stays while its tab exists; its element is checked when the step is reached.
  const kept = content.filter(
    (s) =>
      !anchored(s) || anchor(s) || (s.open && document.getElementById(s.open)),
  );
  // Moves to the next step in `dir` whose element shows; past the end the tour closes.
  const move = async (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < kept.length; i += dir)
      if (await reach(kept[i])) return tour.moveTo(i);
    if (dir === 1) tour.destroy();
  };
  const tour = driver({
    steps: kept.map((s) => ({
      ...(anchored(s) ? { element: () => anchor(s) ?? document.body } : {}),
      popover: { title: s.title, description: s.body, side: s.side },
    })),
    onNextClick: () => void move(tour.getActiveIndex() ?? -1, 1),
    onPrevClick: () => void move(tour.getActiveIndex() ?? 0, -1),
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 4,
    stageRadius: 3,
    popoverClass: styles.popover,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    onPopoverRender: (p) => {
      applyTheme(p.wrapper);
      // Added, not replaced: driver.js finds its buttons by its own class names.
      p.nextButton.classList.add("gn-btn", "gn-btn--solid", "gn-btn--primary");
      p.previousButton.classList.add("gn-btn", "gn-btn--outlined");
    },
    onDestroyed: () => markDone(g),
  });
  for (let i = 0; i < kept.length; i++)
    if (await reach(kept[i])) {
      tour.drive(i);
      break;
    }
  return tour;
}
/** Resolves once the page has painted the guide's first anchor (or its tab), or after a bounded wait. */
function anchorsReady(content: GuideStep[], ms = 8000) {
  const first = content.find((s) => s.open || anchored(s));
  if (!first) return Promise.resolve();
  return appear(
    () => (first.open ? document.getElementById(first.open) : anchor(first)),
    ms,
  );
}
/** Header "Guide" menu: every guide the user may run, grouped by module; another page's guide navigates there first. */
export function GuideLauncher({ access }: { access: string[] }) {
  const path = usePathname();
  const router = useRouter();
  const menu = guideMenu(access);
  const auto = guidesFor(path, access).find((g) => g.auto);
  const details = useRef<HTMLDetailsElement>(null),
    trigger = useRef<HTMLElement>(null),
    active = useRef<Tour | null>(null);
  // A guide chosen for another page, started once that page is reached.
  const pending = useRef<Guide | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const start = useCallback((g: Guide) => {
    active.current?.destroy();
    setBusy(true);
    void loadSteps(g)
      .then((content) => anchorsReady(content).then(() => run(g, content)))
      .then((t) => (active.current = t))
      .catch(() => {}) // A failed content chunk leaves the page as it was.
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  // A chosen guide wins; otherwise the page tour auto-starts once per version.
  useEffect(() => {
    const chosen = pending.current;
    if (chosen?.route === path) {
      pending.current = null;
      return start(chosen);
    }
    if (!auto || chosen || isDone(auto)) return;
    const t = setTimeout(() => start(auto), 800);
    return () => clearTimeout(t);
  }, [auto, path, start]);
  useEffect(() => () => active.current?.destroy(), [path]);
  if (!menu.length) return null;
  function close() {
    if (details.current) details.current.open = false;
  }
  function choose(g: Guide) {
    close();
    if (g.route === path) return start(g);
    pending.current = g;
    router.push(g.route);
  }
  function menuKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
              items.length;
      items[next]?.focus();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.current?.focus();
    }
  }
  return (
    <details id="guide-menu" className="user-menu" ref={details}>
      <summary
        ref={trigger}
        id="guide-menu-button"
        className={styles.button}
        aria-haspopup="menu"
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          if (details.current) details.current.open = true;
          details.current
            ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
            ?.focus();
        }}
      >
        <Icon name="support" />
        Guide
        <Icon name="caret-down" />
      </summary>
      <div
        id="guide-menu-list"
        className={`user-menu-content ${styles.menu}`}
        role="menu"
        aria-label="Guides"
        onKeyDown={menuKeys}
      >
        {menu.map(({ module, tour, items }) => {
          const key = `guide-menu-${functions.ids.idPart(module.id)}`,
            open = expanded === module.id;
          const toggle = () => setExpanded(open ? null : module.id);
          return (
            <div
              key={module.id}
              id={key}
              role="group"
              aria-label={module.label}
            >
              <div className={styles.row}>
                <button
                  id={`${key}-tour`}
                  type="button"
                  role="menuitem"
                  className={styles.tour}
                  disabled={busy}
                  title={tour?.title}
                  onClick={() => (tour ? choose(tour) : toggle())}
                >
                  {module.label}
                </button>
                {items.length > 0 && (
                  <button
                    id={`${key}-toggle`}
                    type="button"
                    role="menuitem"
                    className={styles.toggle}
                    aria-label={`${module.label} guides`}
                    aria-expanded={open}
                    aria-controls={`${key}-items`}
                    onClick={toggle}
                  >
                    <Icon name={open ? "chevron-up" : "chevron-down"} />
                  </button>
                )}
              </div>
              {open && (
                <div id={`${key}-items`} className={styles.items}>
                  {items.map((g) => (
                    <button
                      key={g.id}
                      id={`guide-menu-${g.id}`}
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      onClick={() => choose(g)}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
