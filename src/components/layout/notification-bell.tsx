"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { isOffline, notifications, useApi } from "@/lib/api";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { Pop } from "@/components/ui/pop";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { groupByDay } from "./notification-days";
import { useShell } from "./shell-context";
import styles from "./notification-bell.module.css";
import { functions } from "@/lib/functions";
// Legacy formatDate(datetime, 'hh:mm a').
const time = (at: string) => functions.format.clockDisplay(at, "hh:mm a");
/** The header bell: unread badge, the latest five by local day, and mark-all-read when the popup closes. */
export function NotificationBell() {
  const { labels, format } = useShell();
  const toast = useToast();
  const { run } = useInFlight();
  const remote = useApi(notifications.bell, undefined);
  const bell = remote.data ?? null,
    failure = remote.error ?? null;
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    if (!bell?.unread) return;
    void run(async () => {
      const r = await notifications.markAllRead();
      if (r.ok) return remote.retry();
      // Closing is incidental: a disabled write stays quiet instead of toasting on every close (GN-Angular).
      if (r.error.code !== "WRITES_DISABLED")
        toast.error(
          isOffline(r)
            ? { message: "Notifications could not be marked read." }
            : r.error,
        );
    }, "mark-read");
  }, [bell, remote, run, toast]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, close]);
  const unread = bell?.unread ?? 0;
  return (
    <div id="notifications" className={styles.host} ref={host}>
      <button
        ref={button}
        id="notifications-button"
        type="button"
        className={styles.bell}
        aria-label={
          unread > 0
            ? `${labels.notifications} (${unread} unread)`
            : labels.notifications
        }
        aria-expanded={open}
        aria-controls={open ? "notifications-panel" : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <Pop
            id="notifications-panel"
            className={styles.popup}
            role="dialog"
            aria-label={labels.notifications}
          >
            <div className={styles.head}>
              <Link
                id="notifications-view-all"
                className={styles.link}
                href="/modules/announcements-notifications"
                prefetch={false}
                onClick={close}
              >
                {labels.viewAll}
              </Link>
            </div>
            <div id="notifications-list" className={styles.list}>
              {failure ? (
                <div className={styles.empty} role="alert">
                  <p>{failure.message}</p>
                  {failure.action && <p>{failure.action}</p>}
                  <button
                    id="notifications-retry"
                    type="button"
                    onClick={remote.retry}
                  >
                    Retry
                  </button>
                </div>
              ) : bell === null ? (
                <Skeleton
                  kind="lines"
                  count={5}
                  label="Loading notifications"
                />
              ) : bell.latest.length === 0 ? (
                <div className={styles.empty}>{labels.noData}</div>
              ) : (
                groupByDay(bell.latest).map((day) => (
                  <section
                    key={day.day}
                    id={`notifications-day-${day.day}`}
                    aria-label={day.label ?? day.day}
                  >
                    <div className={styles.day}>
                      {day.label ??
                        functions.format.dateDisplay(day.day, format)}
                    </div>
                    {day.items.map((n) => (
                      <div
                        id={`notification-${n.id}`}
                        className={styles.row}
                        key={n.id}
                      >
                        <div
                          className={styles.content}
                          dangerouslySetInnerHTML={{ __html: n.html }}
                        />
                        <time className={styles.time} dateTime={n.at}>
                          {time(n.at)}
                        </time>
                      </div>
                    ))}
                  </section>
                ))
              )}
            </div>
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
}
