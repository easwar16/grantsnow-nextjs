"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { expand } from "@/lib/motion";
import styles from "./collapsible.module.css";

/**
 * Legacy oj-collapsible, the one expandable panel of the app: a chevron (down while open, right while closed) and a
 * heading whose body slides open and closed (open unless `defaultOpen` is false). It owns the look, so every panel
 * matches; a page sets only the heading's size and spacing (`headClassName`). `actions` sit at the heading's end and
 * never toggle the panel. The <details> stays open until the body has slid shut, as FilterSection does.
 */
export function Collapsible({
  id,
  heading,
  actions,
  className,
  headClassName,
  defaultOpen = true,
  children,
}: {
  id: string;
  heading: ReactNode;
  actions?: ReactNode;
  className?: string;
  headClassName?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen),
    [shown, setShown] = useState(defaultOpen);
  if (open && !shown) setShown(true);
  return (
    <details
      id={id}
      className={`gn-collapsible ${styles.panel} ${className ?? ""}`}
      open={shown}
      data-open={open}
    >
      <summary
        id={`${id}-heading`}
        className={`${styles.head} ${headClassName ?? ""}`}
        aria-expanded={open}
        onClick={(e) => {
          // The state toggles, not the browser, so closing can animate first.
          e.preventDefault();
          if (!(e.target as Element).closest(`.${styles.actions}`))
            setOpen((o) => !o);
        }}
      >
        <Icon name="chevron-down" size={16} className={styles.chevron} />
        {heading}
        {actions && <span className={styles.actions}>{actions}</span>}
      </summary>
      <AnimatePresence initial={false} onExitComplete={() => setShown(false)}>
        {open && (
          <motion.div
            {...expand}
            id={`${id}-panel`}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </details>
  );
}
