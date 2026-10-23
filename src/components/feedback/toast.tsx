"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./toast.module.css";
export type ToastSeverity = "success" | "error" | "warning" | "info";
interface Toast {
  id: number;
  severity: ToastSeverity;
  summary: string;
  detail?: string;
}
/** `persist` defaults to errors only; validation messages pass false (legacy `displayMode: 'transient'`). */
type Show = (
  severity: ToastSeverity,
  summary: string,
  detail?: string,
  persist?: boolean,
) => void;
const ToastContext = createContext<Show>(() => {});
const AUTO_DISMISS_MS = 5000;
/** GN-Angular's toast stack: errors stay until dismissed (the original's persistent error toast), others close after 5 s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]),
    seq = useRef(0);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback<Show>(
    (severity, summary, detail, persist = severity === "error") => {
      const id = ++seq.current;
      // The same message already on screen is not stacked again (repeated failures were seen piling up on live).
      setToasts((all) =>
        all.some(
          (t) =>
            t.severity === severity &&
            t.summary === summary &&
            t.detail === detail,
        )
          ? all
          : [...all, { id, severity, summary, detail }],
      );
      if (!persist) setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div id="toast-stack" className={styles.stack} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            className={`${styles.toast} ${styles[t.severity]} enter-rise`}
            role={t.severity === "error" ? "alert" : "status"}
          >
            <span className={styles.dot} aria-hidden="true" />
            <div className={styles.text}>
              <div className={styles.summary}>{t.summary}</div>
              {t.detail && <div className={styles.detail}>{t.detail}</div>}
            </div>
            <button
              id={`toast-${t.id}-close`}
              type="button"
              className={styles.close}
              aria-label="Close"
              onClick={() => dismiss(t.id)}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
/** `toast("error", summary, detail)`; a failed request passes its `message` and `action` (preventive_action). */
export function useToast() {
  const show = useContext(ToastContext);
  return useMemo(
    () => ({
      show,
      /** A public error from an API route: `code : description` as summary, the backend's preventive action as detail. */
      error: (e: { message: string; action?: string }) =>
        show("error", e.message, e.action),
    }),
    [show],
  );
}
