"use client";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import Link from "next/link";
import { useRef, useState } from "react";
import type { AttentionRow, HomeFilters, WidgetResult } from "../types";
import { State } from "@/components/feedback/state";
import { LatestRequest } from "@/lib/latest-request";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { DeadlineCalendar } from "./deadline-calendar";
import { rowFields } from "./calendar/model";
import { dateDisplay, type FormatSettings } from "@/lib/format";
type PublicError = { code: string; message: string; action?: string };
/** Legacy loads the next page once the list is scrolled to within this many pixels of its end. */
const SCROLL_THRESHOLD = 48;
export function Widget({
  id,
  title,
  initial,
  filters,
  format,
}: {
  id: string;
  title: string;
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
  return (
    <article className="widget">
      <div className="widget-heading">
        <h3>{title}</h3>
        <div className="widget-tools">
          {!error && rows.length > 0 && (
            <div
              className="widget-view-tabs"
              role="tablist"
              aria-label={`${title} view`}
            >
              <button
                role="tab"
                aria-selected={view === "list"}
                onClick={() => setView("list")}
              >
                List View
              </button>
              <button
                role="tab"
                aria-selected={view === "calendar"}
                onClick={() => setView("calendar")}
              >
                Calendar View
              </button>
            </div>
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
      ) : rows.length === 0 ? (
        <State
          title="Nothing to show"
          message="No records match your current scope and filters."
        />
      ) : view === "calendar" ? (
        <DeadlineCalendar
          widgetId={id}
          rows={rows}
          hasMore={hasMore}
          format={format}
        />
      ) : (
        <>
          <ul
            className="attention-list"
            tabIndex={0}
            aria-label={`${title} records`}
            onScroll={(event) => loadMoreOnScroll(event.currentTarget)}
          >
            {rows.map((r) => (
              <li key={r.id} className={r.overdue ? "overdue" : "upcoming"}>
                <div className="attention-reference">
                  <Link href={r.href} prefetch={false}>
                    {r.reference}
                  </Link>
                </div>
                <p>{r.title}</p>
                <RecordMetadata fields={rowFields(r, format)} />
                <div className="attention-date">
                  {r.date && (
                    <time dateTime={r.date.slice(0, 10)}>
                      {dateDisplay(r.date, format)}
                    </time>
                  )}
                  {r.age && <span className="attention-age">{r.age}</span>}
                </div>
              </li>
            ))}
          </ul>
          {loading === "more" && (
            <RecordSkeleton rows={1} label={`Loading more ${title}`} />
          )}
          {moreError && (
            <State
              title="More records unavailable"
              message={moreError.message}
              action={moreError.action}
              code={moreError.code}
              retry={() => load(rows.length)}
            />
          )}
        </>
      )}
    </article>
  );
}
