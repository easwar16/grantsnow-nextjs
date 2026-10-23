"use client";
import { idPart } from "@/lib/ids";
import { useId, useMemo, useState } from "react";
import { useCombobox } from "downshift";
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
import styles from "./select.module.css";
const T = useCombobox.stateChangeTypes;
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * GN-Angular `gn-select` as one combobox: the field shows the choice and is also where you type to narrow the list,
 * so the panel holds only options and opening it never adds a row to the form. Arrow keys move, Enter picks,
 * Escape or an outside click closes and restores the choice; "None" clears it unless `clearable` is false (a native
 * select without a blank option). `name` submits the value with a form through a hidden input. Only the visible rows
 * are drawn. `id` names the root; its parts take `${id}-<part>` (the field is `${id}-trigger`).
 */
export function Select({
  id,
  label,
  options,
  value,
  onChange,
  emptyText = "No options available",
  clearable = true,
  name,
  className,
  describedBy,
  required = false,
  disabled = false,
  invalid = false,
}: {
  id?: string;
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (next: string) => void;
  emptyText?: string;
  clearable?: boolean;
  name?: string;
  className?: string;
  describedBy?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  // null while not typing: the field then shows the chosen label and the list is unfiltered.
  const [query, setQuery] = useState<string | null>(null),
    // Elements are state, not refs: the overlay and the window read them while rendering.
    [input, setInput] = useState<HTMLInputElement | null>(null),
    [box, setBox] = useState<HTMLDivElement | null>(null),
    [pop, setPop] = useState<HTMLDivElement | null>(null),
    [list, setList] = useState<HTMLUListElement | null>(null),
    autoId = useId(),
    base = id ?? autoId,
    panel = `${base}-panel`;
  const chosen = options.find((o) => o.value === value)?.label ?? value,
    needle = (query ?? "").trim().toLowerCase(),
    matches = useMemo(
      () =>
        needle === ""
          ? options
          : options.filter((o) => o.label.toLowerCase().includes(needle)),
      // Long people and funder lists: arrow keys re-render without filtering again.
      [options, needle],
    ),
    // "None" leads the list while something is chosen and nothing is typed.
    rows = [
      ...(clearable && value !== "" && needle === ""
        ? [{ value: "", label: "None" }]
        : []),
      ...matches,
    ],
    optionId = (v: string) => `${base}-option-${v === "" ? "none" : idPart(v)}`;
  const view = useOptionWindow(rows.length, list);
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
    inputId: `${base}-trigger`,
    menuId: `${base}-list`,
    getItemId: (i) => (rows[i] ? optionId(rows[i].value) : ""),
    // The field shows the choice; Downshift's own selection stays empty so each pick is reported.
    selectedItem: null,
    inputValue: query ?? chosen,
    defaultHighlightedIndex: 0,
    // The list is windowed, so the highlighted row is scrolled to by index instead.
    scrollIntoView: () => {},
    stateReducer: (state, action) =>
      comboChanges(state, action, disabled || query !== null),
    onInputValueChange: ({ type, inputValue }) => {
      if (type === T.InputChange) setQuery(inputValue);
    },
    onIsOpenChange: ({ isOpen }) => {
      if (!isOpen) setQuery(null);
    },
    onHighlightedIndexChange: ({ type, highlightedIndex: i }) => {
      if (type !== T.ItemMouseMove && i >= 0) view.scrollTo(i);
    },
    onSelectedItemChange: ({ selectedItem: o }) => {
      if (o && o.value !== value) onChange(o.value);
    },
  });
  const placement = useDropdownPanel(open, box, pop);
  const field = getInputProps({
      ref: setInput,
      className: styles.input,
      type: "text",
      spellCheck: false,
      "aria-label": label,
      "aria-invalid": invalid || undefined,
      "aria-describedby": describedBy,
      "aria-required": required || undefined,
      "aria-controls": panel,
      disabled,
      title: chosen || undefined,
      onKeyDown: (e) => keepNativeKeys(e, open),
    }),
    menu = getMenuProps(
      { ref: setList, "aria-label": label },
      { suppressRefError: true },
    );
  return (
    <div id={id} className={`${styles.host} ${className ?? ""}`}>
      <div
        {...getToggleButtonProps({
          ref: setBox,
          // A plain box around the input, which stays the one combobox and tab stop.
          id: undefined,
          tabIndex: undefined,
          "aria-controls": undefined,
          "aria-expanded": undefined,
          // Opening selects the text to type over; a click while typing places the caret (comboChanges).
          onClick: (e) => {
            // Inside a <label>, the click would otherwise be passed on to the input and toggle the list again.
            e.preventDefault();
            if (disabled || open) return;
            input?.focus();
            input?.select();
          },
        })}
        className={styles.field}
        data-part="field"
        data-open={open || undefined}
        data-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
      >
        <input
          {...field}
          aria-activedescendant={field["aria-activedescendant"] || undefined}
        />
        <Icon className={styles.caret} name="chevron-down" size={12} />
      </div>
      {name !== undefined && <input type="hidden" name={name} value={value} />}
      <AnimatePresence>
        {open && (
          <Pop
            ref={setPop}
            id={panel}
            className={styles.panel}
            style={placement}
            // As on the field: a <label> around the select must not pass an option click on to the input.
            onClick={(e) => e.preventDefault()}
          >
            <ul {...menu} role="listbox" style={view.style}>
              {view.lines.map(({ index }) => {
                const o = rows[index];
                return (
                  <li
                    key={o.value || "none"}
                    {...getItemProps({ item: o, index, ref: view.measure })}
                    role="option"
                    data-index={index}
                    aria-selected={o.value === value && o.value !== ""}
                    aria-disabled={undefined}
                    data-active={index === highlightedIndex || undefined}
                  >
                    {highlight(o.label, needle)}
                  </li>
                );
              })}
              {rows.length === 0 && (
                <li className={styles.none}>
                  {options.length ? "No matches" : emptyText}
                </li>
              )}
            </ul>
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
}
