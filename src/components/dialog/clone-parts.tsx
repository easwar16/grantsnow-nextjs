"use client";
import styles from "./dialog.module.css";
import { functions } from "@/lib/functions";

/** One part a Clone dialog can copy; `fixed` parts are always copied and cannot be unticked. */
export interface ClonePart {
  value: string;
  label: string;
  parent: string | null;
  fixed: boolean;
}
/** A module's legacy checkboxValueUpdate: the parts ticked after one part is ticked or unticked. */
export type CloneToggle = (
  parts: ClonePart[],
  chosen: string[],
  key: string,
  checked: boolean,
) => string[];

/**
 * The full-tree checkboxValueUpdate (claims-unit-inquiry): a part takes all its descendants with it, an ancestor is
 * ticked once all its children are and unticked once none are. Fixed parts stay ticked.
 */
export const toggleCloneTree: CloneToggle = (parts, chosen, key, checked) => {
  const children = (k: string) =>
    parts.filter((p) => p.parent === k).map((p) => p.value);
  const below = (k: string): string[] =>
    children(k).flatMap((c) => [c, ...below(c)]);
  const next = new Set(chosen);
  for (const k of [key, ...below(key)])
    if (checked) next.add(k);
    else next.delete(k);
  let parent = parts.find((p) => p.value === key)?.parent ?? null;
  while (parent) {
    const kids = children(parent);
    if (
      checked ? !kids.every((c) => next.has(c)) : kids.some((c) => next.has(c))
    )
      break;
    if (checked) next.add(parent);
    else next.delete(parent);
    parent = parts.find((p) => p.value === parent)?.parent ?? null;
  }
  for (const p of parts) if (p.fixed) next.add(p.value);
  return parts.map((p) => p.value).filter((v) => next.has(v));
};

/** A Clone dialog's parts: "Entire …" ticks every part, and each part follows the module's legacy cascade. */
export function CloneParts({
  id,
  parts,
  chosen,
  onChange,
  toggle,
  entire,
  legend,
  disabled,
}: {
  id: string;
  parts: ClonePart[];
  chosen: string[];
  onChange: (next: string[]) => void;
  toggle: CloneToggle;
  entire: string;
  legend: string;
  disabled?: boolean;
}) {
  const fixed = parts.filter((p) => p.fixed).map((p) => p.value);
  const all = parts.length > 0 && parts.every((p) => chosen.includes(p.value));
  return (
    <>
      <label className={styles.radio}>
        <input
          id={`${id}-entire`}
          type="checkbox"
          checked={all}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.checked ? parts.map((p) => p.value) : fixed)
          }
        />
        {entire}
      </label>
      <fieldset className={styles.choices} style={{ paddingLeft: 20 }}>
        <legend className="sr-only">{legend}</legend>
        {parts.map((p) => (
          <label key={p.value} className={styles.radio}>
            <input
              id={`${id}-part-${functions.ids.idPart(p.value)}`}
              type="checkbox"
              checked={chosen.includes(p.value)}
              disabled={disabled || p.fixed}
              onChange={(e) =>
                onChange(toggle(parts, chosen, p.value, e.target.checked))
              }
            />
            {p.label}
          </label>
        ))}
      </fieldset>
    </>
  );
}
