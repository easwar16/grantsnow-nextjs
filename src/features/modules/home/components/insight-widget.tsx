"use client";
import { useState } from "react";
import type { HomeFilters } from "../types";
import { home, useApi } from "@/lib/api";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { HelpButton } from "@/components/ui/help-button";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { InsightChart } from "./insight-chart";
import { Icon } from "@/components/ui/icon";
import { type FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
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
  const { data, error, retry } = useApi(home.widget, { id, filters }),
    [expanded, setExpanded] = useState(false);
  const empty = data && functions.charts.chartIsEmpty(data);
  return (
    <section
      id={`insight-${functions.ids.idPart(id)}`}
      className="insight-widget"
      style={{ gridColumn: `span ${data?.presentation?.columns || columns}` }}
    >
      <div className="insight-content">
        <div className="insight-head">
          <h3>
            {title}{" "}
            <HelpButton
              id={`insight-${functions.ids.idPart(id)}-help`}
              html={help}
            />
          </h3>
          <button
            id={`insight-${functions.ids.idPart(id)}-expand`}
            type="button"
            className="chart-expand"
            disabled={!data || !!empty}
            aria-label={`Expand ${title}`}
            onClick={() => setExpanded(true)}
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
          <InsightChart
            id={`insights-chart-${functions.ids.idPart(id)}`}
            title={title}
            data={data}
            format={format}
          />
        )}
      </div>
      {expanded && data && !empty && (
        <ActionDialog
          id={`insight-${functions.ids.idPart(id)}-dialog`}
          title={title}
          help={help ?? null}
          width="70vw"
          className="expanded-chart-dialog"
          closeLabel="Close expanded chart"
          onClose={() => setExpanded(false)}
        >
          <InsightChart
            id={`insights-chart-${functions.ids.idPart(id)}-expanded`}
            title={title}
            data={data}
            format={format}
            expanded
          />
        </ActionDialog>
      )}
    </section>
  );
}
