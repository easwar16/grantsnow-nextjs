/** Launcher geometry, ported from GN-Angular's shell (D26, legacy shell-page.js). Pure, so it is unit-tested. */
export const SNAP_MARGIN = 15;
export type Edge = "left" | "right" | "top" | "bottom";
export type Box = { left: number; top: number; width: number; height: number };
export type Point = { left: number; top: number };
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(v, max));

/** Moves a launcher by a drag delta, kept inside the window. */
export function dragTo(
  start: Box,
  dx: number,
  dy: number,
  vw: number,
  vh: number,
): Point {
  return {
    left: clamp(start.left + dx, 0, vw - start.width),
    top: clamp(start.top + dy, 0, vh - start.height),
  };
}

/** Puts the launcher on one edge, SNAP_MARGIN inside it, keeping (and clamping) the other axis. */
export function toEdge(box: Box, edge: Edge, vw: number, vh: number): Point {
  const m = SNAP_MARGIN;
  if (edge === "left" || edge === "right")
    return {
      left: edge === "left" ? m : vw - box.width - m,
      top: clamp(box.top, m, vh - box.height - m),
    };
  return {
    left: clamp(box.left, m, vw - box.width - m),
    top: edge === "top" ? m : vh - box.height - m,
  };
}

/** The edge closest to the launcher; ties prefer left/right, as the original. */
export function nearestEdge(box: Box, vw: number, vh: number): Edge {
  const d = {
    left: box.left,
    right: vw - box.left - box.width,
    top: box.top,
    bottom: vh - box.top - box.height,
  };
  const min = Math.min(d.left, d.right, d.top, d.bottom);
  return min === d.left
    ? "left"
    : min === d.right
      ? "right"
      : min === d.top
        ? "top"
        : "bottom";
}

export const snapToEdge = (box: Box, vw: number, vh: number) =>
  toEdge(box, nearestEdge(box, vw, vh), vw, vh);

/** Keeps a moved launcher inside a shrunk window, as the original does on resize. */
export function keepInView(box: Box, vw: number, vh: number): Point {
  const m = SNAP_MARGIN;
  return {
    left: Math.min(box.left, Math.max(0, vw - box.width - m)),
    top: Math.min(box.top, Math.max(0, vh - box.height - m)),
  };
}

/**
 * The original positionChatDialog: above the launcher when it fits, else below, right-aligned to it,
 * kept 10px inside the window; at most 450 × 600.
 */
export function chatPosition(
  btn: { top: number; bottom: number; right: number; height: number },
  vw: number,
  vh: number,
) {
  const width = Math.min(450, vw - 20);
  const height = Math.min(600, vh - btn.height - 30);
  const top = btn.top >= height + 10 ? btn.top - height - 10 : btn.bottom + 10;
  return {
    top: clamp(top, 10, vh - height - 10),
    left: clamp(btn.right - width, 10, vw - width - 10),
    width,
    height,
  };
}
