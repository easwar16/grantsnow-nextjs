"use client";
import type { KeyboardEvent } from "react";
import {
  useCombobox,
  type UseComboboxState,
  type UseComboboxStateChangeOptions,
} from "downshift";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";

const MARGIN = 8,
  // The list's own 6px top and bottom padding, and a 6/12-padded row before it is measured.
  PAD = 6,
  ROW = 29;
const T = useCombobox.stateChangeTypes;

/**
 * Places an open dropdown panel as a fixed overlay on its field (GN-Angular's CDK connected overlay): under the field
 * with a 2px gap, above it when there is more room there, at least as wide as the field. Fixed panels take no space
 * in their container, so opening one never scrolls or reflows the form around it. Returns the panel's style.
 */
export function useDropdownPanel(
  open: boolean,
  field: HTMLElement | null,
  panel: HTMLElement | null,
) {
  return useFloating({
    open,
    elements: { reference: field, floating: panel },
    strategy: "fixed",
    placement: "bottom-start",
    // The panel animates its transform, so it is placed with top and left.
    transform: false,
    // The field can move without a scroll or resize (a popup scaling in), so it is followed every frame while shown.
    whileElementsMounted: (field, panel, update) =>
      autoUpdate(field, panel, update, { animationFrame: true }),
    middleware: [
      offset(2),
      flip({ padding: MARGIN }),
      shift({ padding: MARGIN }),
      size({
        padding: MARGIN,
        // The panel's CSS caps its height at the lesser of its own limit and this room.
        apply: ({ rects, availableHeight, elements }) => {
          elements.floating.style.minWidth = `${rects.reference.width}px`;
          elements.floating.style.setProperty(
            "--panel-room",
            `${Math.max(0, availableHeight)}px`,
          );
        },
      }),
    ],
  }).floatingStyles;
}

// Line heights with their margins: the multi-select's cap note has one.
const measure = (line: Element) =>
  (line as HTMLElement).offsetHeight +
  parseFloat(getComputedStyle(line).marginBottom);

/**
 * Renders only the visible lines of an option list (people lists run to thousands). Each line carries
 * `data-index` and `ref={window.measure}`; `style` keeps the list's height as padding around them.
 */
export function useOptionWindow(count: number, list: HTMLUListElement | null) {
  const v = useVirtualizer({
    count,
    getScrollElement: () => list,
    estimateSize: () => ROW,
    paddingStart: PAD,
    paddingEnd: PAD,
    measureElement: measure,
  });
  const lines = v.getVirtualItems(),
    first = lines[0],
    last = lines.at(-1);
  return {
    lines,
    measure: v.measureElement,
    scrollTo: (index: number) => v.scrollToIndex(index),
    style:
      first && last
        ? {
            paddingTop: first.start,
            paddingBottom: v.getTotalSize() - last.end,
          }
        : undefined,
  };
}

/**
 * The combobox behaviour both selects keep from GN-Angular over Downshift's defaults. `held` (disabled, or typing)
 * stops a field click from toggling the list: while typing it places the caret.
 */
export function comboChanges<Item>(
  state: UseComboboxState<Item>,
  { type, changes }: UseComboboxStateChangeOptions<Item>,
  held: boolean,
): Partial<UseComboboxState<Item>> {
  switch (type) {
    case T.ToggleButtonClick:
      return held ? state : changes;
    // The field's click covers the input inside it, and the highlight stays where the pointer left it.
    case T.InputClick:
    case T.MenuMouseLeave:
      return state;
    // Arrow keys stop at the ends rather than wrapping.
    case T.InputKeyDownArrowDown:
      return state.isOpen &&
        (changes.highlightedIndex ?? 0) < state.highlightedIndex
        ? state
        : changes;
    case T.InputKeyDownArrowUp:
      return state.isOpen &&
        (changes.highlightedIndex ?? 0) > state.highlightedIndex
        ? state
        : changes;
    case T.InputKeyDownEnter:
      return state.highlightedIndex < 0 ? state : changes;
    // Leaving closes and restores the choice; it never picks the highlighted row.
    case T.InputBlur:
      return { ...changes, selectedItem: state.selectedItem };
  }
  return changes;
}

/**
 * Keys Downshift leaves to the browser: Home and End move the caret, and Escape on a closed list reaches the popup
 * the field sits in.
 */
export function keepNativeKeys(e: KeyboardEvent, open: boolean) {
  if (e.key === "Home" || e.key === "End" || (e.key === "Escape" && !open))
    (
      e.nativeEvent as Event & { preventDownshiftDefault?: boolean }
    ).preventDownshiftDefault = true;
}
