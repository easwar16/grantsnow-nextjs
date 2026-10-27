import type { ReactNode } from "react";
import styles from "./readonly-field.module.css";

/** A field of a read-only form (legacy oj-form-layout readonly): its label over (or, `edge="start"`, beside) the value. */
export function ReadonlyField({
  id,
  label,
  value,
  help,
  edge = "top",
  className,
}: {
  id?: string;
  label: string;
  value: ReactNode;
  help?: ReactNode;
  edge?: "top" | "start";
  className?: string;
}) {
  return (
    <div
      className={`${styles.field} ${edge === "start" ? styles.start : ""} ${className ?? ""}`}
    >
      <span className={styles.label} id={id && `${id}-label`}>
        {label}
        {help}
      </span>
      <span id={id} className={styles.value}>
        {value}
      </span>
    </div>
  );
}
