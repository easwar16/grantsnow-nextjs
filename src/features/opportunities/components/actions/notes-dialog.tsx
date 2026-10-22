"use client";
import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { useInFlight } from "@/lib/use-in-flight";
import { ActionDialog } from "./action-dialog";
import { callAction, useActionFailure } from "./request";
import styles from "./actions.module.css";
// ponytail: execCommand formatting (deprecated but universally supported); a structured editor is the upgrade path.
const TOOLS = [
  ["bold", "Bold", "B"],
  ["italic", "Italic", "I"],
  ["insertUnorderedList", "Bulleted list", "•"],
  ["insertOrderedList", "Numbered list", "1."],
] as const;
/** The opportunity's notes as rich text; read-only without opportunity-notes edit access. The server sanitises the save. */
export function NotesDialog({
  opportunityId,
  heading,
  notes,
  editable,
  texts,
  onSaved,
  onClose,
}: {
  opportunityId: string;
  heading: string;
  /** Sanitised on the server. */
  notes: string;
  editable: boolean;
  texts: { title: string; notes: string; save: string; close: string };
  onSaved: (notes: string) => void;
  onClose: () => void;
}) {
  const editor = useRef<HTMLDivElement>(null),
    labelId = useId(),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    saving = isActive("notes");
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = notes;
  }, [notes]);
  const save = () =>
    run(async () => {
      const result = await callAction<{ notes: string }>("notes", {
        opportunityId: Number(opportunityId),
        notes: editor.current?.innerHTML ?? "",
      });
      if (!result.ok) return fail(result.error);
      onSaved(result.data.notes);
    }, "notes");
  return (
    <ActionDialog
      title={texts.title}
      subtitle={heading}
      width={720}
      busy={saving}
      closeLabel={texts.close}
      onClose={onClose}
    >
      <span id={labelId} className={styles.label}>
        {texts.notes}
      </span>
      <div className={styles.richText}>
        {editable && (
          <div
            className={styles.toolbar}
            role="toolbar"
            aria-label={`${texts.notes} formatting`}
          >
            {TOOLS.map(([command, name, glyph]) => (
              <button
                key={command}
                type="button"
                aria-label={name}
                title={name}
                disabled={saving}
                // Keep the editor's selection: the toolbar must not take focus on press.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => document.execCommand(command)}
              >
                {glyph}
              </button>
            ))}
          </div>
        )}
        <div
          ref={editor}
          className={styles.editor}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelId}
          aria-readonly={!editable || saving}
          contentEditable={editable && !saving}
          suppressContentEditableWarning
          tabIndex={0}
        />
      </div>
      {editable && (
        <div className={styles.foot}>
          <button
            type="button"
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
