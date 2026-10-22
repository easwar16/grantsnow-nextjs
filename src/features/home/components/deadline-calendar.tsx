"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/feedback/skeleton";
import type { FormatSettings } from "@/lib/format";
import type { AttentionRow } from "../types";

// D19: FullCalendar is its own chunk, fetched the first time a widget opens Calendar View; it measures the DOM, so no SSR.
const DeadlineFullCalendar = dynamic(() => import("./calendar/full-calendar"), {
  ssr: false,
  loading: () => <Skeleton kind="lines" count={8} label="Loading calendar" />,
});

export function DeadlineCalendar({
  widgetId,
  rows,
  hasMore,
  format,
}: {
  widgetId: string;
  rows: AttentionRow[];
  hasMore: boolean;
  format?: FormatSettings;
}) {
  return (
    <div className="deadline-calendar">
      {hasMore && (
        <p className="notice">
          Calendar shows the loaded records. Load further records in List View
          to view their deadlines.
        </p>
      )}
      <DeadlineFullCalendar widgetId={widgetId} rows={rows} format={format} />
    </div>
  );
}
