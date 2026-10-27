"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { expand } from "@/lib/motion";

/**
 * Legacy oj-collapsible: a chevron heading whose body slides open and closed (open unless `defaultOpen` is false).
 * The <details> stays open until the body has slid shut, as FilterSection does.
 */
export function Collapsible({
  id,
  heading,
  className,
  defaultOpen = true,
  children,
}: {
  id: string;
  heading: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen),
    [shown, setShown] = useState(defaultOpen);
  if (open && !shown) setShown(true);
  return (
    <details id={id} className={className} open={shown} data-open={open}>
      <summary
        id={`${id}-heading`}
        aria-expanded={open}
        onClick={(e) => {
          // The state toggles, not the browser, so closing can animate first.
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        <Icon name="chevron-down" size={16} />
        {heading}
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
