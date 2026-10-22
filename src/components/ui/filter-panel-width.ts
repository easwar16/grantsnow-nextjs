/** Width rules for the resizable listing filter panel (owner request, 2026-10-22). */
export const PANEL_WIDTH = { min: 200, max: 560, initial: 240, step: 16 };
/** The results column keeps at least this much room when the panel grows. */
export const RESULTS_MIN_WIDTH = 320;

export function maxWidth(container: number) {
  return Math.max(
    PANEL_WIDTH.min,
    Math.min(PANEL_WIDTH.max, container - RESULTS_MIN_WIDTH),
  );
}

export function clampWidth(width: number, container: number) {
  return Math.round(
    Math.min(maxWidth(container), Math.max(PANEL_WIDTH.min, width)),
  );
}

/** The width a separator key moves to, or undefined for keys it does not handle. */
export function keyWidth(key: string, width: number, container: number) {
  switch (key) {
    case "ArrowLeft":
      return clampWidth(width - PANEL_WIDTH.step, container);
    case "ArrowRight":
      return clampWidth(width + PANEL_WIDTH.step, container);
    case "Home":
      return PANEL_WIDTH.min;
    case "End":
      return maxWidth(container);
    default:
      return undefined;
  }
}

/** A stored width, or undefined when absent or not a usable number. */
export function parseStoredWidth(raw: string | null) {
  if (!raw) return undefined;
  const width = Number(raw);
  return Number.isFinite(width) && width > 0 ? width : undefined;
}

export function storageKey(page: string) {
  return `gn.filter-panel.${page}.width`;
}
