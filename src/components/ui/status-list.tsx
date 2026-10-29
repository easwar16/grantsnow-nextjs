import styles from "./status-list.module.css";
import { functions } from "@/lib/functions";

/**
 * A listing drawer's status tabs (legacy vertical oj-navigation-list): one button per status, the chosen one marked
 * with `aria-current`. `id` names the nav; each button is `${id}-<code>` ("all" for the empty code).
 */
export function StatusList({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <nav id={id} className={styles.statuses} aria-label={label}>
      {options.map((s) => (
        <button
          key={s.value}
          id={`${id}-${functions.ids.idPart(s.value || "all")}`}
          type="button"
          className={s.value === value ? styles.selected : ""}
          aria-current={s.value === value ? "true" : undefined}
          onClick={() => s.value !== value && onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
