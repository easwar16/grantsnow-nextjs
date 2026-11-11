import type { ReactNode } from "react";
import styles from "./figures.module.css";

export interface Figure {
  /** Part of the figure's id (`${id}-${key}`). */
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** A small line under the value (legacy "Fully planned", "Amendments by …"). */
  note?: ReactNode;
  /** A negative or failing value (legacy red Unapplied Balance). */
  danger?: boolean;
}

/**
 * One row of label/value figures separated by thin rules (legacy claims-fund-figures, MR 15893): a fund's totals on
 * the Activities and Claims bars, Fund Inquiry's totals. An empty value shows "—", as legacy.
 */
export function Figures({ id, items }: { id: string; items: Figure[] }) {
  return (
    <dl id={id} className={styles.figures}>
      {items.map((f) => (
        <div key={f.key} id={`${id}-${f.key}`} className={styles.figure}>
          <dt className={styles.label}>{f.label}</dt>
          <dd className={styles.value} data-danger={f.danger || undefined}>
            {f.value === "" || f.value === null || f.value === undefined
              ? "—"
              : f.value}
          </dd>
          {f.note !== undefined && f.note !== "" && (
            <dd className={styles.note}>{f.note}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}
