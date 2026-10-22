"use client";
import { useEffect, useState, type AnimationEvent } from "react";

// Longest leave animation (--gn-dur-slow) plus slack; unmounts anyway if animationend never fires.
const LEAVE_LIMIT_MS = 400;

/**
 * Keeps a closing element mounted until its leave animation ends, so it can animate out.
 * Render while `mounted` and spread `motion` on the element (it pops in, and out while `leaving`).
 */
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  // Opening mounts in the same render (React's adjust-state-during-render pattern).
  if (open && !mounted) setMounted(true);
  const leaving = mounted && !open;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setMounted(false), LEAVE_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  const done = () => !open && setMounted(false);
  return {
    mounted,
    leaving,
    done,
    motion: {
      className: leaving ? "leave-pop" : "enter-pop",
      inert: leaving,
      onAnimationEnd: (e: AnimationEvent) => {
        if (e.target === e.currentTarget) done();
      },
    },
  };
}
