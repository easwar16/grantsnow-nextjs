"use client";
import { dateDisplay, type FormatSettings } from "@/lib/format";
import { ActionDialog } from "./action-dialog";
import styles from "./actions.module.css";
/** Initials for the comment's avatar: first and last name (getShareCommentInitials). */
export function initials(name: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}
/** The original's `DEFAULT_DATE_FORMAT, HH:mm` stamp, in the viewer's time zone. */
function stamp(value: string | undefined, format?: FormatSettings) {
  const at = value ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) return value ?? "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${dateDisplay(day, format)}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
/** The Shared tab's Comments: the one comment the opportunity was shared with (8516 dropped the history endpoint). */
export function CommentsDialog({
  heading,
  shared,
  texts,
  format,
  onClose,
}: {
  heading: string;
  shared?: { by?: string; at?: string; comment?: string };
  texts: {
    title: string;
    singular: string;
    plural: string;
    none: string;
    close: string;
  };
  format?: FormatSettings;
  onClose: () => void;
}) {
  const comment = shared?.comment;
  return (
    <ActionDialog
      title={texts.title}
      subtitle={`${heading} · ${comment ? 1 : 0} ${comment ? texts.singular : texts.plural}`}
      width={640}
      closeLabel={texts.close}
      onClose={onClose}
    >
      {comment ? (
        <div className={`${styles.comment} enter-rise`}>
          <div className={styles.commentHead}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(shared?.by)}
            </span>
            <span className={styles.author}>{shared?.by}</span>
            <time className={styles.time} dateTime={shared?.at}>
              {stamp(shared?.at, format)}
            </time>
          </div>
          <div className={styles.commentBody}>{comment}</div>
        </div>
      ) : (
        <p className={styles.state}>{texts.none}</p>
      )}
    </ActionDialog>
  );
}
