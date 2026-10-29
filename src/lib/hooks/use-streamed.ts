"use client";
import { useEffect, useState } from "react";

/**
 * A server read the page streamed in (a promise it did not await): `undefined` until it lands, then its value. A new
 * promise (a server refresh) keeps the last value on screen until it lands, so nothing blanks. The promise must never
 * reject: pass `settle(read)` or a read that degrades on its own.
 */
export function useStreamed<T>(read: Promise<T>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let live = true;
    void read.then((v) => {
      if (live) setValue(v);
    });
    return () => {
      live = false;
    };
  }, [read]);
  return value;
}
