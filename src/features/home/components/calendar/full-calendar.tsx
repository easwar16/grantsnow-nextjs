"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Icon } from "@/components/ui/icon";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { dateDisplay, type FormatSettings } from "@/lib/format";
import type { AttentionRow } from "../../types";
import {
  PROVIDER_LABELS,
  providerOf,
  providersOf,
  rowFields,
  toCalendarEvents,
  viewLabel,
  type CalendarProvider,
} from "./model";
import { RowLink, type AccessDeniedText } from "../row-link";
import styles from "./calendar.module.css";

const PLUGINS = [dayGridPlugin, timeGridPlugin];
// Legacy fp-proposals-calendar toolbar and views.
const HEADER = {
  left: "toggleCalendars prev,next today",
  center: "title",
  right: "dayGridMonth,dayGridWeek,timeGridDay",
};
const BUTTON_TEXT = {
  today: "Today",
  month: "Month",
  week: "Week",
  day: "Day",
};

/** Month/week/day FullCalendar of a widget's rows, with the legacy provider sidebar and detail panel. */
export default function DeadlineFullCalendar({
  widgetId,
  rows,
  format,
  denied,
}: {
  widgetId: string;
  rows: AttentionRow[];
  format?: FormatSettings;
  denied: AccessDeniedText;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<CalendarProvider>>(
      new Set(),
    ),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [selectedId, setSelectedId] = useState<string>(),
    calendar = useRef<FullCalendar>(null),
    mount = useRef<HTMLDivElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const providers = useMemo(() => providersOf(rows), [rows]),
    events = useMemo(
      () => toCalendarEvents(widgetId, rows, hidden),
      [widgetId, rows, hidden],
    ),
    // Looked up in the current rows, so a refetch that drops the record closes the panel.
    selected = rows.find((r) => r.id === selectedId);

  // FullCalendar only re-measures on window resize; the sidebar, panel and grid change its width too.
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      calendar.current?.getApi().updateSize(),
    );
    observer.observe(mount.current!);
    return () => observer.disconnect();
  }, []);
  // Keyboard users land in the panel they opened from an event.
  useEffect(() => {
    if (selectedId) closeButton.current?.focus();
  }, [selectedId]);

  function toggle(provider: CalendarProvider) {
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(provider)) next.add(provider);
      return next;
    });
  }

  const provider = selected && providerOf(selected);
  return (
    <div className={styles.calendar}>
      {sidebarOpen && (
        <aside className={styles.sidebar} aria-label="Calendars">
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Calendars</span>
            <button
              className={styles.close}
              type="button"
              aria-label="Close calendars"
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className={styles.sidebarBody}>
            {providers.map((p) => (
              <button
                key={p.provider}
                className={styles.sidebarItem}
                type="button"
                aria-pressed={!hidden.has(p.provider)}
                onClick={() => toggle(p.provider)}
              >
                <span
                  className={styles.dot}
                  style={{ background: p.color }}
                  aria-hidden="true"
                />
                <span className={styles.sidebarName}>
                  {PROVIDER_LABELS[p.provider]}
                </span>
                <span className={styles.check}>
                  {!hidden.has(p.provider) && <Icon name="success" />}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}
      <div className={styles.mount} ref={mount}>
        <FullCalendar
          ref={calendar}
          plugins={PLUGINS}
          initialView="dayGridMonth"
          headerToolbar={HEADER}
          buttonText={BUTTON_TEXT}
          customButtons={{
            toggleCalendars: {
              text: "☰ Calendars",
              hint: "Show or hide calendars",
              click: () => setSidebarOpen((open) => !open),
            },
          }}
          height="auto"
          events={events}
          eventClick={(arg) => {
            arg.jsEvent.preventDefault();
            setSelectedId(arg.event.extendedProps.rowId as string);
          }}
        />
      </div>
      {selected && provider && (
        <aside className={styles.panel} aria-label={selected.reference}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderInner}>
              <span className={styles.badge}>{PROVIDER_LABELS[provider]}</span>
              <span className={styles.reference}>{selected.reference}</span>
            </div>
            <button
              ref={closeButton}
              className={styles.close}
              type="button"
              aria-label="Close details"
              onClick={() => setSelectedId(undefined)}
            >
              <Icon name="close" />
            </button>
          </div>
          <p className={styles.panelTitle}>{selected.title}</p>
          <div className={styles.panelBody}>
            <RecordMetadata fields={rowFields(selected, format)} />
            {/* Legacy hides the deadline row for awards, whose date is not a deadline. */}
            {provider !== "AWARD" && selected.date && (
              <dl className={styles.deadline}>
                <dt>Deadline</dt>
                <dd>
                  <time dateTime={selected.date.slice(0, 10)}>
                    {dateDisplay(selected.date, format)}
                  </time>
                  {selected.age && (
                    <span className={styles.warn}>{selected.age}</span>
                  )}
                </dd>
              </dl>
            )}
          </div>
          <div className={styles.panelFooter}>
            <RowLink
              className={styles.viewButton}
              row={selected}
              denied={denied}
            >
              {viewLabel(provider)}
            </RowLink>
          </div>
        </aside>
      )}
    </div>
  );
}
