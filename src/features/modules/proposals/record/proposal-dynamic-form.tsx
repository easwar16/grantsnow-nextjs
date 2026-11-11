"use client";

import { useRef, useState } from "react";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import styles from "./proposal-record.module.css";

export function ProposalDynamicForm({
  type,
  id,
  reference,
  page,
  editable,
  submitLabel,
}: {
  type: string;
  id: string;
  reference: string;
  page: string;
  editable: boolean;
  submitLabel: string;
}) {
  const form = useRef<DynamicFormHandle>(null);
  const [ready, setReady] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!ready || busy || !form.current) return;
    setBusy(true);
    await form.current.save();
    setBusy(false);
  };
  return (
    <section
      id={`proposal-${id}-${page}`}
      className={`${styles.form} ${styles.proposalDynamicForm}`}
    >
      <DynamicForm
        ref={form}
        objectType={type}
        slot={page.toUpperCase()}
        parentId={id}
        objectId={id}
        objectNumber={reference}
        editable={editable}
        hideEmpty
        fullWidthGrid
        onReadyChange={setReady}
        onContentChange={setHasContent}
      />
      {editable && ready && hasContent && (
        <button
          id={`proposal-${id}-${page}-submit`}
          type="button"
          className="gn-btn gn-btn--primary"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      )}
    </section>
  );
}
