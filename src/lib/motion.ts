import type { MotionProps } from "motion/react";

// Copies of --gn-ease, --gn-dur-fast and --gn-dur in globals.css (Motion cannot read CSS variables); keep in step.
const ease = [0.2, 0, 0, 1] as const,
  fast = { duration: 0.15, ease },
  base = { duration: 0.25, ease };

/** .enter-pop / .leave-pop: popups and menus scale in and out. */
export const pop = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: fast,
} satisfies MotionProps;

/** .enter-rise / .leave-fade: toasts rise in and fade out. */
export const rise = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: base },
  exit: { opacity: 0, transition: fast },
} satisfies MotionProps;

/** .enter-fade / .leave-fade: panels such as the record drawer. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: base },
  exit: { opacity: 0, transition: fast },
} satisfies MotionProps;

/** .gn-collapsible: a section's body slides open and closed. */
export const expand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: base,
} satisfies MotionProps;
