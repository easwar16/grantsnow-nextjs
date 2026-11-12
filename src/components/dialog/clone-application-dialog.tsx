"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { CloneParts, toggleCloneTree } from "@/components/dialog/clone-parts";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { Icon } from "@/components/ui/icon";
import styles from "@/components/dialog/dialog.module.css";

type Option = { value: string; label: string; selected: boolean };
/**
 * Legacy dialogCopyEthic / dialogCopyDD: a listed application cloned with the chosen objects ("Entire …" ticks them
 * all; those the backend marks default start ticked). The module reads the options and runs the clone.
 */
export function CloneApplicationDialog({
  id,
  texts,
  options,
  error,
  retry,
  busy,
  failure,
  onClone,
  onClose,
}: {
  id: string;
  texts: Record<"title" | "entire" | "clone" | "cancel", string>;
  options: Option[] | undefined;
  error?: { message: string; code?: string };
  retry: () => void;
  busy: boolean;
  /** The last clone's refusal, shown in the dialog. */
  failure?: string;
  onClone: (objects: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[] | null>(null);
  const parts = (options ?? []).map((o) => ({
    value: o.value,
    label: o.label,
    parent: null,
    fixed: false,
  }));
  const picked =
    chosen ?? (options ?? []).filter((o) => o.selected).map((o) => o.value);
  return (
    <ActionDialog id={id} title={texts.title} busy={busy} onClose={onClose}>
      {!options && !error && <ListSkeleton />}
      {error && (
        <State
          id={`${id}-error-state`}
          title={texts.title}
          message={error.message}
          code={error.code}
          retry={retry}
        />
      )}
      {options && (
        <div id={`${id}-parts`} className={styles.form}>
          <CloneParts
            id={id}
            parts={parts}
            chosen={picked}
            onChange={setChosen}
            toggle={toggleCloneTree}
            entire={texts.entire}
            legend={texts.title}
            disabled={busy}
          />
          {failure && (
            <p id={`${id}-failure`} role="alert">
              {failure}
            </p>
          )}
          <div className={styles.foot}>
            <button
              type="button"
              id={`${id}-cancel`}
              className="gn-btn gn-btn--outlined"
              disabled={busy}
              onClick={onClose}
            >
              {texts.cancel}
            </button>
            <button
              type="button"
              id={`${id}-submit`}
              className="gn-btn gn-btn--primary"
              disabled={busy || !picked.length}
              onClick={() => onClone(picked)}
            >
              <Icon name="copy" size={14} />
              {texts.clone}
            </button>
          </div>
        </div>
      )}
    </ActionDialog>
  );
}
