"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const [checked, setChecked] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const editing = useSearchParams().get("mode") === "edit";
  const update = async (next: boolean) => {
    setPending(true);
    setError("");
    const result = await proposals.setSummaryFinalized(type, id, next);
    if (result.ok) setChecked(result.data.finalized);
    else setError(result.error.message);
    setPending(false);
  };
  return (
    <div id={`proposal-${id}-finalize`} className={styles.finalize}>
      <label htmlFor={`proposal-${id}-finalize-toggle`}>Finalize</label>
      <input
        id={`proposal-${id}-finalize-toggle`}
        type="checkbox"
        checked={checked}
        disabled={!editable || editing || pending}
        onChange={(event) => void update(event.target.checked)}
      />
      {error && !editing && <span role="alert">{error}</span>}
    </div>
  );
}
