"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./actions.module.css";
/**
 * The card dialogs' frame (GN-Angular gn-dialog): modal from mount, closed by its X, Escape or the owner unmounting
 * it. While `busy` it cannot be dismissed, so a write in flight is never orphaned (D44).
 */
export function ActionDialog({
  title,
  subtitle,
  width,
  busy = false,
  closeLabel = "Close",
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  width: number;
  busy?: boolean;
  closeLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-labelledby={id}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onClose}
    >
      <div className={styles.head}>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
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
export function useConfirm() {
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
      title={pending.title}
      width={420}
      closeLabel={pending.cancel}
      onClose={() => settle(false)}
    >
      <p className={styles.message}>{pending.message}</p>
      {pending.detail && <p className={styles.subtitle}>{pending.detail}</p>}
      <div className={styles.foot}>
        <button
          type="button"
          className="gn-btn gn-btn--solid"
          onClick={() => settle(false)}
        >
          {pending.cancel}
        </button>
        <button
          type="button"
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
