"use client";
import { idPart } from "@/lib/ids";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { useMemo, useState } from "react";
import type { HomeFilters, WidgetResult } from "../types";
import { State } from "@/components/feedback/state";
import { home, usePagedApi } from "@/lib/api";
import { HelpButton } from "@/components/ui/help-button";
import { DeadlineCalendar, preloadCalendar } from "./deadline-calendar";
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
  // A failed server render reads nothing until Retry; a good one seeds the first page.
  const [active, setActive] = useState(initial.ok),
    [view, setView] = useState<"list" | "calendar">("list"),
    list = usePagedApi(home.queue, active ? { id, filters } : null, {
      initial: initial.ok
        ? { rows: initial.data.attention, hasMore: initial.data.hasMore }
        : undefined,
    });
  // The server-rendered page shows until the store holds it (the first paint, before the seed lands).
  const seeded = initial.ok && list.rows.length === 0 && list.loading;
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return (seeded && initial.ok ? initial.data.attention : list.rows).filter(
      (r) => !seen.has(r.id) && !!seen.add(r.id),
    );
  }, [seeded, initial, list.rows]);
  const hasMore = seeded && initial.ok ? initial.data.hasMore : list.hasMore;
  const error: PublicError | undefined = !active
    ? initial.ok
      ? undefined
      : initial.error
    : rows.length === 0
      ? list.error
      : undefined;
  const moreError = rows.length > 0 ? list.error : undefined;
  const loading =
    !list.loading || seeded
      ? undefined
      : rows.length === 0
        ? "refresh"
        : "more";
  const retry = () => (active ? list.retry() : setActive(true));
  function loadMoreOnScroll(el: HTMLElement) {
    if (
      hasMore &&
      !loading &&
      !moreError &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD
    )
      list.loadMore();
  }
  const shown = labels.calendar === undefined ? "list" : view;
  return (
    <article id={`widget-${idPart(id)}`} className="attention-widget">
      <div className="attention-content">
        <div className="attention-head">
          <h3>
            {title} <HelpButton id={`widget-${idPart(id)}-help`} html={help} />
          </h3>
          <div
            id={`widget-${idPart(id)}-views`}
            className="attention-view-tabs"
            role="tablist"
            aria-label={`${title} view`}
          >
            <button
              id={`widget-${idPart(id)}-list-view`}
              type="button"
              role="tab"
              aria-selected={shown === "list"}
              onClick={() => setView("list")}
            >
              {labels.list}
            </button>
            {labels.calendar !== undefined && (
              <button
                id={`widget-${idPart(id)}-calendar-view`}
                type="button"
                role="tab"
                aria-selected={shown === "calendar"}
                onPointerEnter={preloadCalendar}
                onFocus={preloadCalendar}
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
            retry={retry}
          />
        ) : shown === "calendar" ? (
          <div
            id={`widget-${idPart(id)}-calendar`}
            className="attention-calendar enter-fade"
          >
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
            id={`widget-${idPart(id)}-list`}
            className="attention-list"
            tabIndex={0}
            aria-label={`${title} records`}
            onScroll={(event) => loadMoreOnScroll(event.currentTarget)}
          >
            {rows.map((r) => (
              <li
                key={r.id}
                id={`widget-${idPart(id)}-row-${idPart(r.id)}`}
                className={`enter-rise${r.overdue ? " overdue" : ""}`}
              >
                <div className="attention-main">
                  <RowLink
                    id={`widget-${idPart(id)}-link-${idPart(r.id)}`}
                    row={r}
                    denied={labels.denied}
                  >
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
              <li id={`widget-${idPart(id)}-empty`} className="attention-empty">
                {labels.empty}
              </li>
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
            retry={list.retry}
          />
        )}
      </div>
    </article>
  );
}
