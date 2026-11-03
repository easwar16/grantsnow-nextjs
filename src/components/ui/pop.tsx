"use client";
import { motion, useIsPresent, type HTMLMotionProps } from "motion/react";
import { pop } from "@/lib/motion";

/** A popup that scales in and out; render it inside `AnimatePresence`. It is inert while leaving. */
export function Pop(props: HTMLMotionProps<"div">) {
  const present = useIsPresent();
  return <motion.div {...pop} inert={!present} {...props} />;
}
