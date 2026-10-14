"use client";
import { InsightChart } from "./insight-chart";
import { RecordSkeleton, ChartSkeleton } from "@/components/feedback/skeleton";
import Link from "next/link";
import { useRef, useState } from "react";
import type { HomeFilters, WidgetResult } from "../types";
import { State } from "@/components/feedback/state";
import { LatestRequest } from "@/lib/latest-request";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { DeadlineCalendar } from "./deadline-calendar";
import { moneyDisplay, dateDisplay } from "@/lib/format";
export function Widget({
  id,
  title,
  initial,
  filters,
  insight = false,
  columns = 6,
}: {
  id: string;
  title: string;
  initial: WidgetResult;
  filters: HomeFilters;
  insight?: boolean;
  columns?: number;
}) {
  const [result, setResult] = useState(initial),
    [loading, setLoading] = useState(false),
    [view, setView] = useState<"list" | "calendar">("list"),
    requests = useRef(new LatestRequest());
  async function load(offset: number) {
    const request = requests.current.begin();
    setLoading(true);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, offset }))
      if (v !== undefined) params.set(k, String(v));
    try {
      const response = await fetch(`/api/home/${id}?${params}`, {
        signal: request.signal,
        cache: "no-store",
      });
      const body = await response.json();
      if (request.current())
        setResult(
          response.ok
            ? { ok: true, data: body }
            : { ok: false, error: body.error },
        );
    } catch {
      if (request.current())
        setResult({
          ok: false,
          error: {
            code: "UPSTREAM",
            message: "This widget could not be refreshed.",
          },
        });
    } finally {
      if (request.current()) setLoading(false);
    }
  }
  const data = result.ok ? result.data : undefined;
  const expandedChart = useRef<HTMLDialogElement>(null);
  return (
    <article
      className={insight ? "widget insight-widget" : "widget"}
      style={
        insight
          ? { gridColumn: `span ${data?.presentation?.columns || columns}` }
          : undefined
      }
    >
      <div className="widget-heading">
        <h3>{title}</h3>
        <div className="widget-tools">
          {data && data.statistics.length === 0 && (
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
          {insight && data && (
            <button
              className="chart-expand"
              aria-label={`Expand ${title}`}
              onClick={() => expandedChart.current?.showModal()}
            >
              ↗
            </button>
          )}
          <button
            className="icon-button"
            aria-label={`Refresh ${title}`}
            onClick={() => load(0)}
            disabled={loading}
          >
            ↻
          </button>
        </div>
      </div>
      {loading ? (
        insight ? (
          <ChartSkeleton label={`Loading ${title}`} />
        ) : (
          <RecordSkeleton label={`Loading ${title}`} />
        )
      ) : !result.ok ? (
        <State
          title="Widget unavailable"
          message={result.error.message}
          code={result.error.code}
          retry={() => load(0)}
        />
      ) : data &&
        data.attention.length === 0 &&
        data.statistics.length === 0 &&
        !data.gauge ? (
        <State
          title="Nothing to show"
          message="No records match your current scope and filters."
        />
      ) : data?.statistics.length || data?.gauge ? (
        <InsightChart title={title} data={data!} />
      ) : view === "calendar" && data ? (
        <DeadlineCalendar rows={data.attention} hasMore={data.hasMore} />
      ) : (
        <ul className="attention-list">
          {data?.attention.map((r) => (
            <li key={r.id} className={!r.overdue ? "upcoming" : "overdue"}>
              <div className="attention-reference">
                {r.href ? (
                  <Link href={r.href} prefetch={false}>
                    {r.reference}
                  </Link>
                ) : (
                  <strong>{r.reference}</strong>
                )}
              </div>
              <p>{r.title}</p>
              <RecordMetadata
                fields={[
                  { label: "Org Unit", value: r.context },
                  { label: "Created by", value: r.createdBy },
                  { label: "Funder", value: r.sponsor },
                  { label: "Deadline Type", value: r.deadlineType },
                  {
                    label: "Deadline Description",
                    value: r.deadlineDescription,
                  },
                  { label: "Pending at:", value: r.stage },
                  {
                    label: "Total Cost",
                    value:
                      r.value == null
                        ? undefined
                        : moneyDisplay(r.value, r.currency),
                  },
                ]}
              />
              <div className="attention-date">
                {r.date && <time>{dateDisplay(r.date)}</time>}
                {r.age && <span className="attention-age">{r.age}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data?.hasMore && (
        <div className="widget-footer">
          <span>
            {data?.attention.length
              ? `${data.attention.length} rows on this page`
              : ""}
          </span>
          {!loading && data && data.statistics.length === 0 && (
            <div>
              <button
                disabled={data.offset === 0}
                onClick={() => load(Math.max(0, data.offset - 5))}
              >
                Previous
              </button>
              <button
                disabled={!data.hasMore}
                onClick={() => load(data.offset + 5)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
      {insight && data && (
        <dialog
          ref={expandedChart}
          className="expanded-chart-dialog"
          aria-label={`Expanded ${title}`}
        >
          <div className="widget-heading">
            <h2>{title}</h2>
            <button
              onClick={() => expandedChart.current?.close()}
              aria-label="Close expanded chart"
            >
              ×
            </button>
          </div>
          <InsightChart title={title} data={data} expanded />
        </dialog>
      )}
    </article>
  );
}
