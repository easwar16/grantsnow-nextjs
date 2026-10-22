import type { ReactNode } from "react";
import styles from "./inside-field.module.css";

/**
 * A Redwood inside-label field (legacy oj-form-layout label-edge="inside", measured on live): one 39px box whose label
 * sits centred while the field is empty and floats to its top on focus or once it has a value. The control inside is
 * bare: a text input, native select, `Select`, `DateInput`, `MultiSelect variant="chips"` or, with `multiline`, a
 * textarea (its label stays at the top). `htmlFor` is the control's id; `filled` says whether it holds a value.
 */
export function InsideField({
  htmlFor,
  label,
  filled,
  required,
  multiline,
  children,
}: {
  htmlFor: string;
  label: string;
  filled: boolean;
  required?: boolean;
  multiline?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.box}
      data-filled={filled || multiline || undefined}
      data-multiline={multiline || undefined}
    >
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {/* Redwood's required mark: a dot after the label. */}
        {required && (
          <span className={styles.required} aria-hidden="true">
            •
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
