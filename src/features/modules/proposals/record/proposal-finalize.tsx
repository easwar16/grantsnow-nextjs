"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { proposals } from "@/lib/api";
import styles from "./proposal-record.module.css";

export function ProposalFinalize({
  type,
  id,
  checked: initial,
  editable,
}: {
  type: string;
  id: string;
  checked: boolean;
  editable: boolean;
}) {
  const [updated, setUpdated] = useState<{
    initial: boolean;
    value: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const editing = useSearchParams().get("mode") === "edit";
  const checked = updated?.initial === initial ? updated.value : initial;
  const update = async (next: boolean) => {
    setPending(true);
    setError("");
    const result = await proposals.setSummaryFinalized(type, id, next);
    if (result.ok) {
      setUpdated({ initial, value: result.data.finalized });
      router.refresh();
    } else setError(result.error.message);
    setPending(false);
  };
  // Hidden in edit mode, as on every record (owner, 2026-11-02).
  if (editing) return null;
  return (
    <div id={`proposal-${id}-finalize`} className={styles.finalize}>
      <label htmlFor={`proposal-${id}-finalize-toggle`}>Finalize</label>
      <input
        id={`proposal-${id}-finalize-toggle`}
        type="checkbox"
        checked={checked}
        disabled={!editable || pending}
        onChange={(event) => void update(event.target.checked)}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
