"use client";
import { useRef } from "react";
import type { HomeFilters, WidgetData } from "../types";
import { useRemote } from "@/lib/use-remote";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { InsightChart } from "./insight-chart";
export function InsightWidget({
  id,
  title,
  filters,
  columns,
}: {
  id: string;
  title: string;
  filters: HomeFilters;
  columns: number;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined) query.set(key, String(value));
  const { data, error, retry } = useRemote<WidgetData>(
      `/api/home/${encodeURIComponent(id)}?${query}`,
    ),
    dialog = useRef<HTMLDialogElement>(null);
  const empty = data && !data.statistics.length && !data.gauge;
  return (
    <article
      className="widget insight-widget"
      style={{ gridColumn: `span ${data?.presentation?.columns || columns}` }}
    >
      <div className="widget-heading">
        <h3>{title}</h3>
        <button
          className="chart-expand"
          disabled={!data || !!empty}
          aria-label={`Expand ${title}`}
          onClick={() => dialog.current?.showModal()}
        >
          <span className="ux-icon" aria-hidden="true">
            {"\uf24c"}
          </span>
        </button>
      </div>
      {error ? (
        <State
          title="Chart unavailable"
          message={error.message}
          code={error.code}
          retry={retry}
        />
      ) : !data ? (
        <ChartSkeleton label={`Loading ${title}`} />
      ) : empty ? (
        <div className="chart-empty" role="status">
          No data to display
        </div>
      ) : (
        <InsightChart title={title} data={data} />
      )}
      <dialog
        ref={dialog}
        className="expanded-chart-dialog"
        aria-label={`Expanded ${title}`}
      >
        <div className="widget-heading">
          <h2>{title}</h2>
          <button
            aria-label="Close expanded chart"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        {data && <InsightChart title={title} data={data} expanded />}
      </dialog>
    </article>
  );
}
