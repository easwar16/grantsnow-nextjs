"use client";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { useRef, useState } from "react";
import type { AttentionRow, HomeFilters, WidgetResult } from "../types";
import { State } from "@/components/feedback/state";
import { LatestRequest } from "@/lib/latest-request";
import { HelpButton } from "@/components/ui/help-button";
import { DeadlineCalendar } from "./deadline-calendar";
import { RowLink, type AccessDeniedText } from "./row-link";
import { rowFields } from "./calendar/model";
import { dateDisplay, type FormatSettings } from "@/lib/format";
type PublicError = { code: string; message: string; action?: string };
/** RB texts of a queue panel; `calendar` is absent when `labels.dashboard-calendar-view` is not visible. */
export interface WidgetLabels {
  list: string;
  calendar?: string;
  empty: string;
  denied: AccessDeniedText;
}
/** Legacy loads the next page once the list is scrolled to within this many pixels of its end. */
const SCROLL_THRESHOLD = 48;
export function Widget({
  id,
  title,
  help,
  labels,
  initial,
  filters,
  format,
}: {
  id: string;
  title: string;
  help?: string | null;
  labels: WidgetLabels;
  initial: WidgetResult;
  filters: HomeFilters;
  format?: FormatSettings;
}) {
  const [error, setError] = useState(initial.ok ? undefined : initial.error),
    [rows, setRows] = useState<AttentionRow[]>(
      initial.ok ? initial.data.attention : [],
    ),
    [hasMore, setHasMore] = useState(initial.ok && initial.data.hasMore),
    [loading, setLoading] = useState<"refresh" | "more">(),
    [moreError, setMoreError] = useState<PublicError>(),
    [view, setView] = useState<"list" | "calendar">("list"),
    requests = useRef(new LatestRequest());
  // Offset 0 replaces the queue (refresh/retry); later offsets append the next scroll page.
  async function load(offset: number) {
    const request = requests.current.begin();
    setLoading(offset === 0 ? "refresh" : "more");
    setMoreError(undefined);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, offset }))
      if (v !== undefined) params.set(k, String(v));
    let failure: PublicError | undefined;
    try {
      const response = await fetch(`/api/home/${id}?${params}`, {
        signal: request.signal,
        cache: "no-store",
      });
      const body = await response.json();
      if (!request.current()) return;
      if (!response.ok) failure = body.error;
      else {
        const page: AttentionRow[] = body.attention;
        setRows((current) => {
          if (offset === 0) return page;
          const seen = new Set(current.map((r) => r.id));
          return [...current, ...page.filter((r) => !seen.has(r.id))];
        });
        setHasMore(body.hasMore === true);
        if (offset === 0) setError(undefined);
      }
    } catch {
      if (!request.current()) return;
      failure = {
        code: "UPSTREAM",
        message: "This widget could not be refreshed.",
      };
    }
    if (failure) {
      if (offset === 0) setError(failure);
      else setMoreError(failure);
    }
    setLoading(undefined);
  }
  function loadMoreOnScroll(list: HTMLElement) {
    if (
      hasMore &&
      !loading &&
      !moreError &&
      list.scrollTop + list.clientHeight >= list.scrollHeight - SCROLL_THRESHOLD
    )
      void load(rows.length);
  }
  const shown = labels.calendar === undefined ? "list" : view;
  return (
    <article className="attention-widget">
      <div className="attention-content">
        <div className="attention-head">
          <h3>
            {title} <HelpButton html={help} />
          </h3>
          <div
            className="attention-view-tabs"
            role="tablist"
            aria-label={`${title} view`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={shown === "list"}
              onClick={() => setView("list")}
            >
              {labels.list}
            </button>
            {labels.calendar !== undefined && (
              <button
                type="button"
                role="tab"
                aria-selected={shown === "calendar"}
                onClick={() => setView("calendar")}
              >
                {labels.calendar}
              </button>
            )}
          </div>
        </div>
        {loading === "refresh" ? (
          <RecordSkeleton label={`Loading ${title}`} />
        ) : error ? (
          <State
            title="Widget unavailable"
            message={error.message}
            action={error.action}
            code={error.code}
            retry={() => load(0)}
          />
        ) : shown === "calendar" ? (
          <div className="attention-calendar">
            <DeadlineCalendar
              widgetId={id}
              rows={rows}
              hasMore={hasMore}
              format={format}
              denied={labels.denied}
            />
          </div>
        ) : (
          <ul
            className="attention-list"
            tabIndex={0}
            aria-label={`${title} records`}
            onScroll={(event) => loadMoreOnScroll(event.currentTarget)}
          >
            {rows.map((r) => (
              <li key={r.id} className={r.overdue ? "overdue" : undefined}>
                <div className="attention-main">
                  <RowLink row={r} denied={labels.denied}>
                    {r.reference}
                  </RowLink>
                  <div className="attention-title">{r.title}</div>
                  <dl className="attention-fields">
                    {rowFields(r, format)
                      .filter(
                        (f) =>
                          f.value !== null &&
                          f.value !== undefined &&
                          f.value !== "",
                      )
                      .map((f) => (
                        <div
                          key={f.label}
                          className={f.shifted ? "shifted" : undefined}
                        >
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
                <div className="attention-meta">
                  {r.date && (
                    <time dateTime={r.date.slice(0, 10)}>
                      {dateDisplay(r.date, format)}
                    </time>
                  )}
                  {r.age && <div className="attention-note">{r.age}</div>}
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="attention-empty">{labels.empty}</li>
            )}
            {loading === "more" && (
              <li className="attention-loading">
                <RecordSkeleton rows={1} label={`Loading more ${title}`} />
              </li>
            )}
          </ul>
        )}
        {moreError && shown === "list" && (
          <State
            title="More records unavailable"
            message={moreError.message}
            action={moreError.action}
            code={moreError.code}
            retry={() => load(rows.length)}
          />
        )}
      </div>
    </article>
  );
}
