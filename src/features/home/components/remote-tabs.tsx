"use client";
import { useRef, useState } from "react";
import { InsightChart } from "./insight-chart";
import Link from "next/link";
import { State } from "@/components/feedback/state";
import { RecordSkeleton, ChartSkeleton } from "@/components/feedback/skeleton";
import { dateDisplay, moneyDisplay } from "@/lib/format";
import type { OpportunityPage } from "@/features/opportunities/types";
import { useRemote } from "@/lib/use-remote";
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
  points: { series: string; group: string; value: number }[];
};
export function NotificationsPanel() {
  const [offset, setOffset] = useState(0);
  const { data, error, retry } = useRemote<NotificationPage>(
    `/api/home/tabs/notifications?offset=${offset}`,
  );
  return (
    <article className="widget notification-panel">
      <div className="widget-heading">
        <h3>Notifications</h3>
        <button aria-label="Refresh notifications" onClick={retry}>
          ↻
        </button>
      </div>
      {error ? (
        <State
          title="Notifications unavailable"
          message={error.message}
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
                {dateDisplay(row.date)}{" "}
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
        <span>
          {data ? `${data.rows.length} rows on this page` : "Fetching page"}
        </span>
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
export function FeaturedPanel() {
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
        <button aria-label="Refresh featured opportunities" onClick={retry}>
          ↻
        </button>
      </div>
      {error ? (
        <State
          title="Opportunities unavailable"
          message={error.message}
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
          {data.rows.map((row) => (
            <li key={row.id}>
              <div className="featured-heading">
                <h3>
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noopener noreferrer">
                      {row.title}
                    </a>
                  ) : (
                    row.title
                  )}
                </h3>
                <span className="status-chip">{row.status}</span>
              </div>
              <div className="record-metadata">
                <div>
                  <strong>Funder</strong>
                  <span>{row.funders || "—"}</span>
                </div>
                <div>
                  <strong>Funding Type</strong>
                  <span>{row.fundingType || "—"}</span>
                </div>
                {row.totalFund !== undefined && (
                  <div>
                    <strong>Total Fund</strong>
                    <span>{moneyDisplay(row.totalFund, row.currency)}</span>
                  </div>
                )}
                {row.closing && (
                  <div>
                    <strong>Closing Date</strong>
                    <span>{dateDisplay(row.closing)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setPreview(row);
                  dialog.current?.showModal();
                }}
              >
                More information
              </button>
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
        <span>
          {data
            ? `${data.rows.length} rows · ${data.total} API total`
            : "Fetching page"}
        </span>
        <button disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
        <Link href="/opportunities">View all opportunities</Link>
      </div>
      <dialog
        ref={dialog}
        className="opportunity-preview"
        aria-label="Opportunity information"
      >
        <h2>{preview?.title}</h2>
        {preview?.summary ? (
          <div dangerouslySetInnerHTML={{ __html: preview.summary }} />
        ) : (
          <p>No summary available.</p>
        )}
        <form method="dialog">
          <button>Close</button>
        </form>
      </dialog>
    </article>
  );
}
export function ChartGraphic({ chart }: { chart: ChartData }) {
  const types: Record<string, "pie" | "line" | "area" | "bar"> = {
    PIE: "pie",
    DONUT: "pie",
    LINE: "line",
    LA: "area",
    AREA: "area",
    BAR: "bar",
  };
  return (
    <InsightChart
      title={chart.name}
      height={250}
      showData
      data={{
        attention: [],
        statistics: chart.points.map((p, i) => ({
          id: String(i),
          label: p.group,
          series: p.series,
          value: p.value,
        })),
        hasMore: false,
        offset: 0,
        presentation: {
          type: types[chart.type] || "pie",
          columns: chart.columns,
        },
      }}
    />
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
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState<{ code: string; message: string }>();
  const chart = data?.[0];
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setSaveError(undefined);
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
    } finally {
      setSaving(false);
    }
  }
  return (
    <article
      className="widget dynamic-chart-card"
      style={{
        gridColumn: `span ${dimensions?.columns || chart?.columns || 6}`,
        minHeight: (dimensions?.rows || chart?.rows || 3) * 80,
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
                  Open report
                </a>
              )}
            </details>
          )}
          <button aria-label={`Refresh ${descriptor.name}`} onClick={retry}>
            ↻
          </button>
        </div>
      </div>
      {error ? (
        <State
          title="Chart unavailable"
          message={error.message}
          code={error.code}
          retry={retry}
        />
      ) : !data ? (
        <ChartSkeleton label={`Loading ${descriptor.name}`} />
      ) : !data.length || data.every((c) => !c.points.length) ? (
        <State title="Nothing to show" />
      ) : (
        data.map((chart) => <ChartGraphic key={chart.id} chart={chart} />)
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
                max="12"
                required
                defaultValue={dimensions?.rows || chart?.rows || 3}
              />
            </label>
          </div>
          {saveError && (
            <State
              title="Save failed"
              message={saveError.message}
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
