"use client";
import { useRef } from "react";
import type { HomeFilters, WidgetData } from "../types";
import { chartIsEmpty } from "@/lib/chart-options";
import { useRemote } from "@/lib/use-remote";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { HelpButton } from "@/components/ui/help-button";
import { InsightChart } from "./insight-chart";
import { Icon } from "@/components/ui/icon";
import type { FormatSettings } from "@/lib/format";
export function InsightWidget({
  id,
  title,
  help,
  empty: emptyText,
  filters,
  columns,
  format,
}: {
  id: string;
  title: string;
  help?: string | null;
  /** RB `helper-texts.no-data`. */
  empty: string;
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
    <section
      className="insight-widget"
      style={{ gridColumn: `span ${data?.presentation?.columns || columns}` }}
    >
      <div className="insight-content">
        <div className="insight-head">
          <h3>
            {title} <HelpButton html={help} />
          </h3>
          <button
            type="button"
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
          // Legacy draws an empty gauge blank, not as "No data".
          <div className="chart-empty" role="status">
            {data.presentation?.type === "gauge" ? "" : emptyText}
          </div>
        ) : (
          <InsightChart title={title} data={data} format={format} />
        )}
      </div>
      <dialog
        ref={dialog}
        className="expanded-chart-dialog"
        aria-label={`Expanded ${title}`}
      >
        <div className="expanded-chart-head">
          <h2>
            {title} <HelpButton html={help} />
          </h2>
          <button
            type="button"
            className="expanded-chart-close"
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
    </section>
  );
}
