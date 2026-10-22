"use client";
import { useCallback, useRef, useState } from "react";
/**
 * A user-triggered write blocks its control until the request settles (GN-Angular D44); nothing is throttled.
 * `run` ignores a second start while the same key is running; bind `disabled={isActive(key)}`.
 */
export function useInFlight() {
  const running = useRef(new Set<string>());
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const run = useCallback(
    async <T>(task: () => Promise<T>, key = ""): Promise<T | undefined> => {
      if (running.current.has(key)) return undefined;
      running.current.add(key);
      setActive(new Set(running.current));
      try {
        return await task();
      } finally {
        running.current.delete(key);
        setActive(new Set(running.current));
      }
    },
    [],
  );
  const isActive = useCallback((key = "") => active.has(key), [active]);
  return { run, isActive, busy: active.size > 0 };
}
