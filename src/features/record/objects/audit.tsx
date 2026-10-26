"use client";
import { useState } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { objects, useApi } from "@/lib/api";
import {
  AUDIT_EVENTS,
  CONTRACT_AUDIT_EVENTS,
  type AuditEvent,
  type ObjectPanelProps,
} from "./panel-types";
import styles from "./panels.module.css";

// The drawer's oj-badge per event (success, info, danger).
const TONES: Record<string, string> = {
  INSERTED: "success",
  UPDATED: "info",
  "NEW VERSION CREATED": "info",
  DELETED: "danger",
};
/**
 * A record page's audit trail (each detail page's audit drawer): ALL / INSERTED / UPDATED / DELETED tabs, each a
 * server read filtered by event; an entry shows who and when, then each field: inserted values, updated old → new,
 * deleted old values struck through. Opening the panel starts on ALL, as the drawer's open chain resets it.
 */
export function ObjectAudit(props: ObjectPanelProps) {
  const { id } = props;
  const events =
    props.objectType === "CONTRACT" ? CONTRACT_AUDIT_EVENTS : AUDIT_EVENTS;
  const [event, setEvent] = useState<AuditEvent>("ALL");
  const { data, error, retry } = useApi(objects.audit, {
    objectType: props.objectType,
    objectId: props.objectId,
    page: props.page,
    event,
  });
  const select = (next: AuditEvent, focus?: HTMLElement | null) => {
    setEvent(next);
    focus?.focus();
  };
  return (
    <div id={id} className={styles.panel}>
      <div
        id={`${id}-tabs`}
        role="tablist"
        aria-label="Audit events"
        className={styles.tabs}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const at = events.findIndex((name) => name === event),
            last = events.length - 1;
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? last
                : (at + (e.key === "ArrowRight" ? 1 : last)) % events.length;
          select(
            events[next],
            e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next],
          );
        }}
      >
        {events.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`${id}-tab-${name.toLowerCase()}`}
            aria-selected={event === name}
            aria-controls={`${id}-list`}
            tabIndex={event === name ? 0 : -1}
            onClick={() => select(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        id={`${id}-list`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${event.toLowerCase()}`}
        className={styles.thread}
      >
        {error ? (
          <State
            id={`${id}-error`}
            title="The audit trail could not be loaded"
            message={error.message}
            code={error.code}
            action={error.action}
            retry={retry}
          />
        ) : !data ? (
          <Skeleton kind="lines" count={4} label="Loading audit trail" />
        ) : data.items.length === 0 ? (
          <p id={`${id}-empty`} className={styles.empty}>
            {data.noData}
          </p>
        ) : (
          <ul className={styles.audits}>
            {/* Contracts also show the NEW VERSION CREATED audit event. */}
            {data.items.map(
              (a) =>
                TONES[a.event] && (
                  <li
                    key={a.key}
                    id={`${id}-entry-${a.key}`}
                    className={`${styles.audit} enter-rise`}
                    data-tone={TONES[a.event]}
                  >
                    <div className={styles.auditHead}>
                      <span className="gn-status" data-tone={TONES[a.event]}>
                        {a.event}
                      </span>
                      <span className={styles.who}>
                        {a.name}
                        <span>{a.at}</span>
                      </span>
                    </div>
                    <dl className={styles.fields}>
                      {a.fields.map((f, i) => (
                        <div key={`${f.name}-${i}`} className={styles.field}>
                          <dt title={f.name}>{f.name}</dt>
                          <dd>
                            {a.event === "INSERTED" ? (
                              f.value
                            ) : (
                              <>
                                <del>{f.old}</del>
                                {(a.event === "UPDATED" ||
                                  a.event === "NEW VERSION CREATED") && (
                                  <span>{f.value}</span>
                                )}
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
