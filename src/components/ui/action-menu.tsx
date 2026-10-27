"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Pop } from "@/components/ui/pop";

export interface MenuItem {
  key: string;
  label: string;
  run: () => void;
  disabled?: boolean;
}
/**
 * A button that opens a menu of actions (GN-Angular cdkMenu, legacy oj-menu-button): arrow keys move, Escape closes and
 * returns focus, an outside press closes. Items take `${id}-${key}`.
 */
export function ActionMenu({
  id,
  label,
  icon = "overflow",
  items,
  iconSize,
  disabled,
  className = "chart-menu-trigger",
}: {
  id: string;
  label: string;
  icon?: IconName;
  iconSize?: number;
  items: MenuItem[];
  disabled?: boolean;
  className?: string;
}) {
  // Fixed under the trigger, so a scrolling table cannot clip it.
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null),
    host = useRef<HTMLDivElement>(null),
    isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    host.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(null);
    };
    // A scroll moves the trigger; the fixed list follows it.
    const follow = () => {
      const r = host.current?.querySelector("button")?.getBoundingClientRect();
      if (r) setOpen({ top: r.bottom, right: window.innerWidth - r.right });
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", follow, true);
    };
  }, [isOpen]);
  const move = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const all = [
      ...e.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    ];
    const i = all.indexOf(document.activeElement as HTMLElement);
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (e.key === "Escape") {
      setOpen(null);
      host.current?.querySelector<HTMLElement>("button")?.focus();
    } else if (e.key in step) {
      e.preventDefault();
      all[(i + step[e.key] + all.length) % all.length]?.focus();
    }
  };
  return (
    <div className="chart-menu" ref={host}>
      <button
        id={`${id}-button`}
        type="button"
        className={className}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOpen((o) =>
            o ? null : { top: r.bottom, right: window.innerWidth - r.right },
          );
        }}
      >
        <Icon name={icon} size={iconSize} />
      </button>
      <AnimatePresence>
        {open && (
          <Pop
            id={`${id}-list`}
            role="menu"
            aria-label={label}
            className="chart-menu-list"
            style={{ position: "fixed", ...open }}
            onKeyDown={move}
          >
            {items.map((item) => (
              <button
                key={item.key}
                id={`${id}-${item.key}`}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(null);
                  item.run();
                }}
              >
                {item.label}
              </button>
            ))}
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
}
