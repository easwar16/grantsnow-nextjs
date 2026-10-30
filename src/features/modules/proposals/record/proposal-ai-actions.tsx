"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { proposals } from "@/lib/api";
import styles from "./proposal-record.module.css";

type Kind = "summary" | "comparison";
export function ProposalAiActions({
  type,
  id,
  summaryLabel,
  comparisonLabel,
  canCompare,
}: {
  type: string;
  id: string;
  summaryLabel: string | null;
  comparisonLabel: string | null;
  canCompare: boolean;
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const open = async (next: Kind) => {
    if (pending) return;
    setKind(next);
    setHtml("");
    setError("");
    setPending(true);
    const result = await proposals.ai(type, id, next);
    if (result.ok) setHtml(result.data.html);
    else setError(result.error.message);
    setPending(false);
  };
  return (
    <>
      {summaryLabel && (
        <button
          id={`proposal-${id}-ai-summary`}
          type="button"
          className={styles.actionButton}
          disabled={pending}
          onClick={() => void open("summary")}
        >
          ◉ &nbsp; {summaryLabel}
        </button>
      )}
      {comparisonLabel && (
        <button
          id={`proposal-${id}-compare`}
          type="button"
          className={styles.actionButton}
          disabled={!canCompare || pending}
          onClick={() => void open("comparison")}
        >
          ▧ &nbsp; {comparisonLabel}
        </button>
      )}
      {kind && (
        <ActionDialog
          id={`proposal-${id}-ai-dialog`}
          title="Dynamic AI Content"
          width="29.341vw"
          onClose={() => setKind(null)}
        >
          <div className={styles.aiContent}>
            {pending ? (
              <p role="status">Loading…</p>
            ) : error ? (
              <p role="alert">{error}</p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </ActionDialog>
      )}
    </>
  );
}
