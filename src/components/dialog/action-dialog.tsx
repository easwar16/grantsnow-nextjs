"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { pickerOpen } from "@/components/ui/date-input";
import styles from "./dialog.module.css";
/**
 * The card dialogs' frame (GN-Angular gn-dialog): modal from mount, closed by its X, Escape or the owner unmounting
 * it. While `busy` it cannot be dismissed, so a write in flight is never orphaned (D44).
 */
export function ActionDialog({
  id,
  title,
  subtitle,
  width,
  className,
  busy = false,
  closeLabel = "Close",
  onClose,
  children,
}: {
  /** The dialog's page-unique id; its parts derive theirs from it. */
  id: string;
  title: string;
  subtitle?: string;
  /** A vw length from the legacy width class; omitted, Redwood's default 600px dialog, at most 70vh tall (owner, 2026-10-27). */
  width?: string;
  className?: string;
  busy?: boolean;
  closeLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      id={id}
      className={`${styles.dialog}${width ? "" : ` ${styles.standard}`}${className ? ` ${className}` : ""}`}
      style={{ width: `min(${width ?? "34.384vw"}, calc(100vw - 32px))` }}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        if (busy || pickerOpen(ref.current)) e.preventDefault();
      }}
      onClose={onClose}
    >
      <div className={styles.head}>
        <h2 id={`${id}-title`}>{title}</h2>
        <button
          type="button"
          id={`${id}-close`}
          className={styles.close}
          aria-label={closeLabel}
          disabled={busy}
          onClick={() => ref.current?.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
    </dialog>
  );
}
export interface ConfirmOptions {
  title: string;
  message: string;
  detail?: string;
  confirm: string;
  cancel: string;
  danger?: boolean;
}
/** `ask(options)` resolves true on confirm, false on cancel or dismiss; render `element` once in the caller. */
export function useConfirm(id: string) {
  const [pending, setPending] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );
  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const element = pending && (
    <ActionDialog
      id={id}
      title={pending.title}
      closeLabel={pending.cancel}
      onClose={() => settle(false)}
    >
      <p id={`${id}-message`} className={styles.message}>
        {pending.message}
      </p>
      {pending.detail && <p className={styles.detail}>{pending.detail}</p>}
      <div className={styles.foot}>
        <button
          type="button"
          id={`${id}-cancel`}
          className="gn-btn gn-btn--outlined"
          onClick={() => settle(false)}
        >
          {pending.cancel}
        </button>
        <button
          type="button"
          id={`${id}-confirm`}
          className={`gn-btn gn-btn--primary${pending.danger ? ` ${styles.danger}` : ""}`}
          onClick={() => settle(true)}
        >
          {pending.confirm}
        </button>
      </div>
    </ActionDialog>
  );
  return { ask, element };
}
