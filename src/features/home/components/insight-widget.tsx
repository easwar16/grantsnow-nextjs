"use client";
import { useRef } from "react";
import type { HomeFilters, WidgetData } from "../types";
import { chartIsEmpty } from "@/lib/chart-options";
import { useRemote } from "@/lib/use-remote";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { InsightChart } from "./insight-chart";
import { Icon } from "@/components/ui/icon";
import type { FormatSettings } from "@/lib/format";
export function InsightWidget({
  id,
  title,
  filters,
  columns,
  format,
}: {
  id: string;
  title: string;
  filters: HomeFilters;
  columns: number;
  format?: FormatSettings;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined) query.set(key, String(value));
  const { data, error, retry } = useRemote<WidgetData>(
      `/api/home/${encodeURIComponent(id)}?${query}`,
    ),
    dialog = useRef<HTMLDialogElement>(null);
  const empty = data && chartIsEmpty(data);
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
          <Icon name="expand" />
        </button>
      </div>
      {error ? (
        <State
          title="Chart unavailable"
          message={error.message}
          action={error.action}
          code={error.code}
          retry={retry}
        />
      ) : !data ? (
        <ChartSkeleton label={`Loading ${title}`} />
      ) : empty ? (
        <div className="chart-empty" role="status">
          No data to display.
        </div>
      ) : (
        <InsightChart title={title} data={data} format={format} />
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
            <Icon name="close" />
          </button>
        </div>
        {data && !empty && (
          <InsightChart title={title} data={data} format={format} expanded />
        )}
      </dialog>
    </article>
  );
}
