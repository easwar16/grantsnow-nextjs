"use client";
import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

const GAP = 2;
const MARGIN = 8;

/**
 * Places an open dropdown panel as a fixed overlay on its field (GN-Angular's CDK connected overlay): under the field
 * with a 2px gap, above it when there is more room there, at least as wide as the field. Fixed panels take no space
 * in their container, so opening one never scrolls or reflows the form around it.
 */
export function useAnchor(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  maxHeight: number,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0,
      last = "";
    // The field can move without a scroll or resize (a popup scaling in, a reflow), so it is followed every frame
    // while open; the style only changes when its box does.
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const key = rect
        ? `${rect.left}|${rect.top}|${rect.width}|${rect.height}|${window.innerWidth}|${window.innerHeight}`
        : "";
      if (rect && key !== last) {
        last = key;
        const below = window.innerHeight - rect.bottom - GAP - MARGIN,
          above = rect.top - GAP - MARGIN,
          down = below >= Math.min(maxHeight, 160) || below >= above;
        setStyle({
          position: "fixed",
          left: Math.max(
            MARGIN,
            Math.min(rect.left, window.innerWidth - rect.width - MARGIN),
          ),
          minWidth: rect.width,
          maxHeight: Math.min(maxHeight, down ? below : above),
          ...(down
            ? { top: rect.bottom + GAP }
            : { bottom: window.innerHeight - rect.top + GAP }),
        });
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [open, anchor, maxHeight]);
  return open ? style : undefined;
}
