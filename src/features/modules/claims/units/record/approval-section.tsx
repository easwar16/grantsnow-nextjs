"use client";
import { State } from "@/components/feedback/state";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { claims, useApi } from "@/lib/api";
import styles from "./summary.module.css";

/**
 * A fund's or an amendment's approval route on the shared workflow (legacy claims-unit-activities approvals list,
 * Submit for Approval and Withdraw). `doc` is `fund-<id>` or `amendment-<fund>-<id>`; after a write the route and
 * its host (status, buttons) read again.
 */
export function ApprovalSection({
  id,
  appId,
  doc,
  hint,
  onChanged,
}: {
  id: string;
  appId: string;
  doc: string;
  /** Why Submit is missing (legacy submit-needs-zero-unapplied). */
  hint?: string | null;
  onChanged: () => void;
}) {
  const read = useApi(claims.workflow, { appId, doc });
  if (read.error)
    return (
      <State
        id={`${id}-error`}
        title="Couldn't load the approval route"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!read.data) return <ListSkeleton label="Loading the approval route" />;
  return (
    <section id={id} className={styles.panelSection}>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      <ApprovalWorkflow
        id={`${id}-workflow`}
        api={claims.workflowApi(appId, doc)}
        view={read.data}
        onChanged={() => {
          read.retry();
          onChanged();
        }}
      />
    </section>
  );
}
