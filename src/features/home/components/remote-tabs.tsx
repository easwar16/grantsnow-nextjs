"use client";
import { useMemo, useRef, useState } from "react";
import { InsightChart } from "./insight-chart";
import { chartIsEmpty, dynamicChartData } from "@/lib/chart-options";
import Link from "next/link";
import { State } from "@/components/feedback/state";
import { RecordSkeleton, ChartSkeleton } from "@/components/feedback/skeleton";
import { dateDisplay } from "@/lib/format";
import type { OpportunityPage } from "@/features/opportunities/types";
import {
  OpportunityCard,
  OpportunityInformation,
} from "@/features/opportunities/components/opportunity-card";
import { countText } from "@/features/opportunities/display";
import { useRemote } from "@/lib/use-remote";
import type { FormatSettings } from "@/lib/format";
import { useInFlight } from "@/lib/use-in-flight";
type NotificationPage = {
  rows: { id: string; html: string; read: boolean; date: string }[];
  offset: number;
  limit: number;
  hasMore: boolean;
};
export type ChartData = {
  id: string;
  name: string;
  type: string;
  columns: number;
  rows: number;
  dimensions?: boolean;
  reportUrl?: string;
  points: { series: string; group: string; value: number | null }[];
};
export function NotificationsPanel({ format }: { format?: FormatSettings }) {
  const [offset, setOffset] = useState(0);
  const { data, error, retry } = useRemote<NotificationPage>(
    `/api/home/tabs/notifications?offset=${offset}`,
  );
  return (
    <article className="widget notification-panel">
      <div className="widget-heading">
        <h3>Notifications</h3>
      </div>
      {error ? (
        <State
          title="Notifications unavailable"
          message={error.message}
          action={error.action}
          code={error.code}
          retry={retry}
        />
      ) : !data ? (
        <RecordSkeleton label="Loading notifications" />
      ) : !data.rows.length ? (
        <State title="Nothing to show" />
      ) : (
        <ul className="notification-list">
          {data.rows.map((row) => (
            <li key={row.id}>
              <span
                className={`notification-avatar${row.read ? "" : " unread"}`}
                aria-label={row.read ? "Read message" : "Unread message"}
              >
                {row.read ? "✉" : "●"}
              </span>
              <div dangerouslySetInnerHTML={{ __html: row.html }} />
              <time dateTime={row.date}>
                {dateDisplay(row.date, format)}{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(row.date))}{" "}
                UTC
              </time>
            </li>
          ))}
        </ul>
      )}
      <div className="pagination">
        <button
          disabled={offset === 0 || !data}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          Previous
        </button>
        <span>{data ? `${data.rows.length} rows on this page` : null}</span>
        <button
          disabled={!data?.hasMore}
          onClick={() => setOffset(offset + 25)}
        >
          Next
        </button>
      </div>
    </article>
  );
}
export function FeaturedPanel({ format }: { format?: FormatSettings }) {
  const [page, setPage] = useState(1),
    [preview, setPreview] = useState<OpportunityPage["rows"][number]>();
  const dialog = useRef<HTMLDialogElement>(null);
  const { data, error, retry } = useRemote<OpportunityPage>(
    `/api/home/tabs/opportunities?page=${page}`,
  );
  return (
    <article className="widget">
      <div className="widget-heading">
        <h3>Featured Opportunities</h3>
      </div>
      {error ? (
        <State
          title="Opportunities unavailable"
          message={error.message}
          action={error.action}
          code={error.code}
          retry={retry}
        />
      ) : !data ? (
        <RecordSkeleton
          variant="opportunity"
          label="Loading featured opportunities"
        />
      ) : !data.rows.length ? (
        <State title="Nothing to show" />
      ) : (
        <ul className="featured-opportunities">
          {data.countsUnavailable && (
            <li role="status">
              Application and proposal counts could not be loaded.
            </li>
          )}
          {data.rows.map((row) => (
            <li key={row.id}>
              <OpportunityCard
                format={format}
                row={row}
                card={data.card}
                onMoreInfo={(next) => {
                  setPreview(next);
                  dialog.current?.showModal();
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="pagination">
        <button
          disabled={page === 1 || !data}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>{data ? countText(data) : "Fetching page"}</span>
        <button disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
        <Link href="/opportunities">View all opportunities</Link>
      </div>
      <OpportunityInformation ref={dialog} row={preview} />
    </article>
  );
}
export function ChartGraphic({
  chart,
  rows,
}: {
  chart: ChartData;
  rows: number;
}) {
  // A stable object, so a re-render does not rebuild the chart.
  const data = useMemo(() => dynamicChartData(chart), [chart]);
  return chartIsEmpty(data) ? (
    <div className="chart-empty" role="status">
      No data to display.
    </div>
  ) : (
    // Legacy .height-N: N × 150 px.
    <InsightChart title={chart.name} height={150 * rows} showData data={data} />
  );
}
function RemoteChart({
  descriptor,
  organization,
}: {
  descriptor: { id: string; name: string };
  organization?: string;
}) {
  const { data, error, retry } = useRemote<ChartData[]>(
    `/api/home/tabs/charts?id=${descriptor.id}${organization ? `&organization=${encodeURIComponent(organization)}` : ""}`,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [dimensions, setDimensions] = useState<{
      columns: number;
      rows: number;
    }>(),
    [saveError, setSaveError] = useState<{
      code: string;
      message: string;
      action?: string;
    }>(),
    { run, isActive } = useInFlight(),
    saving = isActive("dimensions");
  const chart = data?.[0];
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSaveError(undefined);
    await run(async () => {
      try {
        const response = await fetch("/api/home/tabs/charts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            infolet_id: Number(descriptor.id),
            colspan: Number(fields.get("columns")),
            rowspan: Number(fields.get("rows")),
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          setSaveError(body.error);
          return;
        }
        setDimensions(body);
        dialog.current?.close();
      } catch {
        setSaveError({
          code: "UPSTREAM",
          message: "Dimensions could not be saved. Please retry.",
        });
      }
    }, "dimensions");
  }
  return (
    <article
      className="widget dynamic-chart-card"
      style={{
        gridColumn: `span ${dimensions?.columns || chart?.columns || 6}`,
      }}
    >
      <div className="widget-heading">
        <h3>{descriptor.name}</h3>
        <div className="widget-tools">
          {chart && (chart.dimensions || chart.reportUrl) && (
            <details className="chart-options">
              <summary>Options</summary>
              {chart.dimensions && (
                <button
                  onClick={() => {
                    setSaveError(undefined);
                    dialog.current?.showModal();
                  }}
                >
                  Dimensions
                </button>
              )}
              {chart.reportUrl && (
                <a
                  href={chart.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Link
                </a>
              )}
            </details>
          )}
        </div>
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
        <ChartSkeleton label={`Loading ${descriptor.name}`} />
      ) : !data.length ? (
        <div className="chart-empty" role="status">
          No data to display.
        </div>
      ) : (
        data.map((chart) => (
          <ChartGraphic
            key={chart.id}
            chart={chart}
            rows={dimensions?.rows || chart.rows}
          />
        ))
      )}
      <dialog
        ref={dialog}
        className="chart-dimension-dialog"
        aria-labelledby={`dimension-title-${descriptor.id}`}
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <h2 id={`dimension-title-${descriptor.id}`}>Dimensions</h2>
        <form onSubmit={save}>
          <div className="dimension-fields">
            <label>
              Cols
              <input
                name="columns"
                type="number"
                min="1"
                max="12"
                required
                defaultValue={dimensions?.columns || chart?.columns || 6}
              />
            </label>
            <label>
              Rows
              <input
                name="rows"
                type="number"
                min="1"
                max="3"
                required
                defaultValue={dimensions?.rows || chart?.rows || 3}
              />
            </label>
          </div>
          {saveError && (
            <State
              title="Save failed"
              message={saveError.message}
              action={saveError.action}
              code={saveError.code}
            />
          )}
          <div className="dialog-actions">
            <button
              type="button"
              disabled={saving}
              onClick={(event) => {
                event.currentTarget.form
                  ?.querySelectorAll("input")
                  .forEach((input) => {
                    input.value = "";
                  });
              }}
            >
              Clear
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button className="primary" disabled={saving} type="submit">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </article>
  );
}
export function DynamicChartsPanel({
  charts,
  organization,
}: {
  charts: { id: string; name: string; module: string }[];
  organization?: string;
}) {
  const modules = [...new Set(charts.map((c) => c.module))],
    [module, setModule] = useState(modules[0]);
  return (
    <>
      <div
        className="dynamic-module-tabs"
        role="tablist"
        aria-label="Dynamic chart modules"
      >
        {modules.map((name) => (
          <button
            role="tab"
            key={name}
            aria-selected={name === module}
            tabIndex={name === module ? 0 : -1}
            onKeyDown={(event) => {
              let next: number | undefined;
              const i = modules.indexOf(name);
              if (event.key === "ArrowRight") next = (i + 1) % modules.length;
              if (event.key === "ArrowLeft")
                next = (i + modules.length - 1) % modules.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = modules.length - 1;
              if (next !== undefined) {
                event.preventDefault();
                setModule(modules[next]);
                document
                  .getElementById(`dynamic-selector-${modules[next]}`)
                  ?.focus();
              }
            }}
            aria-controls={`dynamic-module-${name}`}
            id={`dynamic-selector-${name}`}
            onClick={() => setModule(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`dynamic-module-${module}`}
        aria-labelledby={`dynamic-selector-${module}`}
        className="dynamic-chart-grid"
      >
        {charts
          .filter((c) => c.module === module)
          .map((c) => (
            <RemoteChart
              key={`${c.id}:${organization}`}
              descriptor={c}
              organization={organization}
            />
          ))}
      </section>
    </>
  );
}
