"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { RichText } from "@/components/ui/rich-text";
import { useInFlight } from "@/lib/use-in-flight";
import { ActionDialog } from "./action-dialog";
import { callAction, useActionFailure } from "./request";
import styles from "./actions.module.css";
/** The opportunity's notes in the shared Quill editor (GN-Angular); read-only without opportunity-notes edit access. The server sanitises the save. */
export function NotesDialog({
  id,
  opportunityId,
  heading,
  notes,
  editable,
  texts,
  onSaved,
  onClose,
}: {
  id: string;
  opportunityId: string;
  heading: string;
  /** Sanitised on the server. */
  notes: string;
  editable: boolean;
  texts: { title: string; notes: string; save: string; close: string };
  onSaved: (notes: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<string | null>(notes),
    [shownNotes, setShownNotes] = useState(notes),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    saving = isActive("notes");
  // Saved notes come back sanitised: the editor takes them as its value.
  if (notes !== shownNotes) {
    setShownNotes(notes);
    setValue(notes);
  }
  const save = () =>
    run(async () => {
      const result = await callAction<{ notes: string }>("notes", {
        opportunityId: Number(opportunityId),
        notes: value ?? "",
      });
      if (!result.ok) return fail(result.error);
      onSaved(result.data.notes);
    }, "notes");
  return (
    <ActionDialog
      id={id}
      title={texts.title}
      subtitle={heading}
      width={720}
      busy={saving}
      closeLabel={texts.close}
      onClose={onClose}
    >
      <span id={`${id}-label`} className={styles.label}>
        {texts.notes}
      </span>
      <div id={`${id}-editor`} aria-labelledby={`${id}-label`} role="group">
        <RichText
          value={value}
          onChange={setValue}
          label={texts.notes}
          readOnly={!editable}
          disabled={saving}
        />
      </div>
      {editable && (
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={saving}
            onClick={save}
          >
            <Icon name="save" />
            {texts.save}
          </button>
        </div>
      )}
    </ActionDialog>
  );
}
