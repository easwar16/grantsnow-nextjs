"use client";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { useFormat } from "@/components/layout/shell-context";
import { functions } from "@/lib/functions";
import type { DueDiligenceShellModel } from "@/server/modules/due-diligence/record/shell";
import styles from "./overview-tab.module.css";

/** The general overview (legacy duediligence-general-overview): the setup's header fields, read-only. */
export function OverviewTab({ model }: { model: DueDiligenceShellModel }) {
  const format = useFormat();
  return (
    <>
      <section
        id="due-diligence-overview"
        className={styles.section}
        aria-label={model.labels.overview}
      >
        <div className={styles.fields}>
          {model.fields.map((f) => (
            <ReadonlyField
              key={f.key}
              id={`due-diligence-${f.key}`}
              label={f.label}
              value={
                f.date ? functions.format.dateDisplay(f.value, format) : f.value
              }
            />
          ))}
        </div>
      </section>
      {model.participants && (
        <section
          id="due-diligence-people"
          className={styles.section}
          aria-labelledby="due-diligence-people-title"
        >
          <h2 id="due-diligence-people-title">{model.participants.label}</h2>
          {model.participants.people.length ? (
            <ul id="due-diligence-participants">
              {model.participants.people.map((person) => (
                <li
                  id={`due-diligence-participant-${person.id}`}
                  key={person.id}
                >
                  {person.name} {person.org && `— ${person.org}`}{" "}
                  {person.status && `— ${person.status}`}
                </li>
              ))}
            </ul>
          ) : (
            <p id="due-diligence-no-participants">No participants added.</p>
          )}
        </section>
      )}
    </>
  );
}
