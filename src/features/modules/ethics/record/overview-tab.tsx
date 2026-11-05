"use client";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { useFormat } from "@/components/layout/shell-context";
import { functions } from "@/lib/functions";
import type { EthicsShellModel } from "@/server/modules/ethics/record/shell";
import styles from "./overview-tab.module.css";

/** The general overview (legacy ethics-general-overview): the setup's header fields, read-only. */
export function OverviewTab({ model }: { model: EthicsShellModel }) {
  const format = useFormat();
  return (
    <>
      <section
        id="ethics-overview"
        className={styles.section}
        aria-label={model.labels.overview}
      >
        <div className={styles.fields}>
          {model.fields.map((f) => (
            <ReadonlyField
              key={f.key}
              id={`ethics-${f.key}`}
              label={f.label}
              value={
                f.date ? functions.format.dateDisplay(f.value, format) : f.value
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}
