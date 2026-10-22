"use client";
import { idPart } from "@/lib/ids";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/feedback/skeleton";
import type { FormatSettings } from "@/lib/format";
import type { AttentionRow } from "../types";
import type { AccessDeniedText } from "./row-link";

// D19: FullCalendar is its own chunk, fetched the first time a widget opens Calendar View; it measures the DOM, so no SSR.
const DeadlineFullCalendar = dynamic(() => import("./calendar/full-calendar"), {
  ssr: false,
  loading: () => <Skeleton kind="lines" count={8} label="Loading calendar" />,
});
/** Fetches the calendar chunk on intent (hover or focus on Calendar View); the bundler shares it. */
export const preloadCalendar = () => {
  import("./calendar/full-calendar").catch(() => {
    // The calendar's own load retries and shows its failure.
  });
};

export function DeadlineCalendar({
  widgetId,
  rows,
  hasMore,
  format,
  denied,
}: {
  widgetId: string;
  rows: AttentionRow[];
  hasMore: boolean;
  format?: FormatSettings;
  denied: AccessDeniedText;
}) {
  return (
    <div id={`calendar-${idPart(widgetId)}`} className="deadline-calendar">
      {hasMore && (
        <p id={`calendar-${idPart(widgetId)}-notice`} className="notice">
          Calendar shows the loaded records. Load further records in List View
          to view their deadlines.
        </p>
      )}
      <DeadlineFullCalendar
        widgetId={widgetId}
        rows={rows}
        format={format}
        denied={denied}
      />
    </div>
  );
}
