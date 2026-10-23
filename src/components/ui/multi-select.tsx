"use client";
import { idPart } from "@/lib/ids";
import { useId, useMemo, useState } from "react";
import { useCombobox, useMultipleSelection } from "downshift";
import { Icon } from "@/components/ui/icon";
import { highlight } from "@/components/ui/highlight";
import { AnimatePresence } from "motion/react";
import { Pop } from "@/components/ui/pop";
import {
  comboChanges,
  keepNativeKeys,
  useDropdownPanel,
  useOptionWindow,
} from "@/components/ui/dropdown";
import styles from "./multi-select.module.css";
const T = useCombobox.stateChangeTypes,
  M = useMultipleSelection.stateChangeTypes;
export interface MultiSelectOption {
  value: string;
  label: string;
  /** A second, quieter line (live's people list: org unit and employee number). */
  detail?: string;
}
/**
 * GN-Angular `gn-multi-select` as one combobox: the inside variant is a 45px box whose label floats above chips of
 * the chosen values; the control variant is one 28px line of the chosen labels and a count, for top-labelled forms.
 * You type in the field itself to narrow the checkbox list, so opening it never adds a row to the form. Arrow keys
 * move, Enter ticks or unticks, Backspace on an empty field drops the last chip, Escape or an outside click closes.
 * The chips variant has no label of its own, for an `InsideField` box (live's oj-select-many). `limit` caps the
 * rows offered, with live's "More results available" note; `closeOnPick` closes the list after each pick, as live.
 * Only the visible rows are drawn. `id` names the root; its parts take `${id}-<part>` (the field is `${id}-field`).
 */
export function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
  className,
  variant = "inside",
  limit,
  closeOnPick = false,
  disabled = false,
}: {
  id?: string;
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  variant?: "inside" | "control" | "chips";
  limit?: number;
  closeOnPick?: boolean;
  disabled?: boolean;
}) {
  // null while not typing: the control variant then shows its summary and the list is unfiltered.
  const [query, setQuery] = useState<string | null>(null),
    // Elements are state, not refs: the overlay and the window read them while rendering.
    [input, setInput] = useState<HTMLInputElement | null>(null),
    [box, setBox] = useState<HTMLDivElement | null>(null),
    [pop, setPop] = useState<HTMLDivElement | null>(null),
    [list, setList] = useState<HTMLUListElement | null>(null),
    autoId = useId(),
    base = id ?? autoId,
    panel = `${base}-panel`;
  const control = variant === "control",
    chips = variant === "chips";
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v,
    summary = value.map(labelOf).join(", "),
    needle = (query ?? "").trim().toLowerCase(),
    matches = useMemo(
      () =>
        needle === ""
          ? options
          : options.filter((o) =>
              `${o.label} ${o.detail ?? ""}`.toLowerCase().includes(needle),
            ),
      // Long people and funder lists: arrow keys re-render without filtering again.
      [options, needle],
    ),
    rows = limit === undefined ? matches : matches.slice(0, limit),
    // The cap note is the window's first line when shown.
    lead = matches.length > rows.length ? 1 : 0,
    optionId = (v: string) => `${base}-option-${idPart(v)}`;
  const view = useOptionWindow(rows.length + lead, list);
  const { getDropdownProps, addSelectedItem, removeSelectedItem } =
    useMultipleSelection<string>({
      selectedItems: value,
      onSelectedItemsChange: ({ selectedItems }) =>
        onChange(selectedItems ?? []),
      stateReducer: (state, { type, changes }) => {
        // Chips are a pointer shortcut, not keyboard stops; keyboard users untick the option or press Backspace.
        if (type === M.DropdownKeyDownNavigationPrevious) return state;
        // Backspace drops the last chip only from an empty field that shows chips.
        if (
          type === M.DropdownKeyDownBackspace &&
          (control || query || state.selectedItems.length === 0)
        )
          return state;
        return changes;
      },
    });
  const {
    isOpen: open,
    highlightedIndex,
    getToggleButtonProps,
    getInputProps,
    getMenuProps,
    getItemProps,
  } = useCombobox({
    items: rows,
    itemToString: (o) => o?.label ?? "",
    itemToKey: (o) => o?.value,
    inputId: `${base}-field`,
    menuId: `${base}-list`,
    getItemId: (i) => (rows[i] ? optionId(rows[i].value) : ""),
    // Ticks live in `value`; Downshift's own selection stays empty so each pick is reported.
    selectedItem: null,
    inputValue: query ?? (control ? summary : ""),
    defaultHighlightedIndex: 0,
    // The list is windowed, so the highlighted row is scrolled to by index instead.
    scrollIntoView: () => {},
    stateReducer: (state, action) => {
      const changes = comboChanges(state, action, disabled || query !== null);
      if (action.type !== T.ItemClick && action.type !== T.InputKeyDownEnter)
        return changes;
      // A pick ticks or unticks and, unless it closes on pick, keeps the list, its filter and its highlight.
      return closeOnPick
        ? changes
        : {
            ...changes,
            isOpen: state.isOpen,
            highlightedIndex: state.highlightedIndex,
            inputValue: state.inputValue,
          };
    },
    onInputValueChange: ({ type, inputValue }) => {
      if (type === T.InputChange) setQuery(inputValue);
    },
    onIsOpenChange: ({ isOpen }) => {
      if (!isOpen) setQuery(null);
    },
    onHighlightedIndexChange: ({ type, highlightedIndex: i }) => {
      if (type !== T.ItemMouseMove && i >= 0) view.scrollTo(i + lead);
    },
    onSelectedItemChange: ({ selectedItem: o }) => {
      if (!o) return;
      if (value.includes(o.value)) removeSelectedItem(o.value);
      else addSelectedItem(o.value);
    },
  });
  const placement = useDropdownPanel(open, box, pop);
  const field = getInputProps(
      getDropdownProps({
        ref: setInput,
        className: styles.input,
        type: "text",
        spellCheck: false,
        "aria-label": label,
        "aria-controls": panel,
        disabled,
        placeholder:
          variant === "inside" && value.length === 0 ? label : undefined,
        onFocus: () => control && input?.select(),
        onKeyDown: (e) => keepNativeKeys(e, open),
      }),
    ),
    menu = getMenuProps(
      { ref: setList, "aria-label": label },
      { suppressRefError: true },
    );
  return (
    <div
      id={id}
      className={`${styles.host} ${className ?? ""}`}
      data-variant={variant}
    >
      <div
        {...getToggleButtonProps({
          ref: setBox,
          // A plain box around the input, which stays the one combobox and tab stop.
          id: undefined,
          tabIndex: undefined,
          "aria-controls": undefined,
          "aria-expanded": undefined,
          // A click that toggles the list closed leaves focus; any other keeps it in the field (comboChanges).
          onClick: () => {
            if (disabled || (open && query === null)) return;
            input?.focus();
          },
        })}
        className={styles.field}
        data-part="field"
        data-multi={chips || undefined}
        data-open={open || undefined}
        aria-disabled={disabled || undefined}
      >
        {variant === "inside" && value.length > 0 && (
          <span className={styles.label}>{label}</span>
        )}
        <span className={styles.line}>
          {!control &&
            value.map((v) => (
              <span key={v} className={styles.chip}>
                {labelOf(v)}
                {/* Pointer shortcut only; keyboard users untick the option or press Backspace. */}
                <button
                  id={`${base}-remove-${idPart(v)}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelOf(v)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelectedItem(v);
                  }}
                >
                  <Icon name="close" size={10} />
                </button>
              </span>
            ))}
          <input
            {...field}
            title={summary || undefined}
            aria-activedescendant={field["aria-activedescendant"] || undefined}
          />
          {control && value.length > 1 && query === null && (
            <span className={styles.count}>{value.length}</span>
          )}
        </span>
        <Icon className={styles.caret} name="chevron-down" size={12} />
      </div>
      <AnimatePresence>
        {open && (
          <Pop
            ref={setPop}
            id={panel}
            className={styles.panel}
            style={placement}
          >
            <ul
              {...menu}
              role="listbox"
              aria-multiselectable="true"
              style={view.style}
            >
              {view.lines.map(({ index }) => {
                if (index < lead)
                  return (
                    <li
                      key="note"
                      ref={view.measure}
                      data-index={index}
                      className={styles.note}
                    >
                      More results available, please filter further.
                    </li>
                  );
                const i = index - lead,
                  o = rows[i],
                  ticked = value.includes(o.value);
                return (
                  <li
                    key={o.value}
                    {...getItemProps({ item: o, index: i, ref: view.measure })}
                    role="option"
                    data-index={index}
                    aria-selected={ticked}
                    aria-disabled={undefined}
                    data-active={i === highlightedIndex || undefined}
                  >
                    {!chips && (
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        aria-hidden="true"
                        checked={ticked}
                        readOnly
                      />
                    )}
                    <span className={styles.text}>
                      <span>{highlight(o.label, needle)}</span>
                      {o.detail && (
                        <span className={styles.detail}>
                          {highlight(o.detail, needle)}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
              {rows.length === 0 && <li className={styles.none}>No matches</li>}
            </ul>
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
}
