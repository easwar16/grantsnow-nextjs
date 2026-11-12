"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ethics } from "@/lib/api";
import { useConfirm } from "@/components/dialog/action-dialog";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { useFormat } from "@/components/layout/shell-context";
import { functions } from "@/lib/functions";
import type { EthicsShellModel } from "@/server/modules/ethics/record/shell";
import { DynamicForm } from "@/features/record/dynamic-form/dynamic-form";
import styles from "./overview-tab.module.css";

/** The general overview (legacy ethics-general-overview): the setup's header fields, read-only. */
export function OverviewTab({
  model,
  selectedParticipant,
  participants,
  reviewers,
  references,
  canUnlink,
}: {
  model: EthicsShellModel;
  selectedParticipant?: string;
  participants: { id: string; name: string; org: string; status: string }[];
  reviewers: { id: string; name: string }[];
  references: {
    id: string;
    type: string;
    number: string;
    relationId: string | null;
  }[];
  canUnlink: boolean;
}) {
  const format = useFormat();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const confirm = useConfirm("ethics-unlink-confirm");
  async function unlink(relationId: string, number: string) {
    if (
      !(await confirm.ask({
        title: model.labels.unlinkTitle,
        message: number,
        confirm: model.labels.unlink,
        cancel: model.referenceLink.cancel,
      }))
    )
      return;
    setBusy(relationId);
    setError("");
    const result = await ethics.unlinkReference(
      model.id,
      model.access,
      relationId,
      "ethics-general-overview",
    );
    setBusy(null);
    if (result.ok) router.refresh();
    else setError(result.error.message);
  }
  return (
    <>
      <div className={styles.layout}>
        <div
          id="ethics-overview"
          className={styles.main}
          aria-label={model.labels.overview}
        >
          {model.statusCode === "DRFT" && (
            <section
              id="ethics-overview-summary"
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
                      f.date
                        ? functions.format.dateDisplay(f.value, format)
                        : f.value
                    }
                  />
                ))}
              </div>
            </section>
          )}
          {selectedParticipant && model.formType && (
            <DynamicForm
              objectType="ETHICS"
              slot="ETHICS"
              parentId={model.id}
              objectId={selectedParticipant}
              formType={model.formType}
              editable={false}
              fullWidthGrid
              legacyReadOnly
            />
          )}
        </div>
        <section id="ethics-overview-people" className={styles.section}>
          <h2>{model.labels.participants}</h2>
          {participants.length ? (
            <ul>
              {participants.map((person) => (
                <li key={person.id}>
                  {person.name}
                  {person.org && (
                    <small className={styles.org}>{person.org}</small>
                  )}
                  {person.status && (
                    <small className={styles.status}>{person.status}</small>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>{model.labels.noData}</p>
          )}
          <h2>{model.labels.supervisor}</h2>
          {reviewers.length ? (
            <ul>
              {reviewers.map((person) => (
                <li key={person.id}>{person.name}</li>
              ))}
            </ul>
          ) : (
            <p>{model.labels.noData}</p>
          )}
          {model.showReferences && references.length > 0 && (
            <>
              <h2>{model.labels.references}</h2>
              <ul id="ethics-overview-references">
                {references.map((reference) => (
                  <li key={`${reference.type}-${reference.id}`}>
                    {reference.number || reference.id} · {reference.type}
                    {canUnlink && reference.relationId && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        id={`ethics-overview-unlink-${reference.relationId}`}
                        aria-label={`${model.labels.unlink} ${reference.number || reference.id}`}
                        onClick={() =>
                          void unlink(
                            reference.relationId!,
                            reference.number || reference.id,
                          )
                        }
                      >
                        {model.labels.unlink}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
      {confirm.element}
    </>
  );
}
