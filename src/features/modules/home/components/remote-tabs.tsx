"use client";
import { useMemo, useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { InsightChart } from "./insight-chart";
import { State } from "@/components/feedback/state";
import { ListSkeleton, ChartSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { Icon } from "@/components/ui/icon";
import { ActionMenu } from "@/components/ui/action-menu";
import { OpportunityCard } from "@/features/modules/opportunities/components/opportunity-card";
import { home, isOffline, useApi, usePagedApi } from "@/lib/api";
import type { PagedEndpoint } from "@/lib/api/hooks";
import { type FormatSettings } from "@/lib/format";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { functions } from "@/lib/functions";
type Failure = { code: string; message: string; action?: string };
export type ChartData = {
  id: string;
  name: string;
  type: string;
  columns: number;
  rows: number;
  dimensions?: boolean;
  reportUrl?: string;
  texts: Record<
    "options" | "dimension" | "link" | "title" | "save" | "empty",
    string
  >;
  points: { series: string; group: string; value: number | null }[];
};
const UNREACHABLE: Failure = {
  code: "UPSTREAM",
  message: "This request could not be completed.",
};
/** A request that got no answer keeps this panel's own failure text. */
const failureOf = (error?: Failure) =>
  error && isOffline({ ok: false, error }) ? UNREACHABLE : error;
/**
 * GN-Angular `paged()`: pages load as the list nears its end, one request at a time. Each "row" of the endpoint is one
 * page as the route answered it.
 */
function useScrollPages<P>(ep: PagedEndpoint<void, P>, threshold: number) {
  const list = usePagedApi(ep, undefined);
  const failure = failureOf(list.error);
  return {
    pages: list.rows,
    failure,
    // Nothing held yet, or the next page: a tab revisited shows its held pages while they refresh.
    loading: (list.loading && !list.last) || list.loadingMore,
    retry: list.retry,
    onScroll: (e: React.UIEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (
        !list.loading &&
        !failure &&
        list.hasMore &&
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      )
        list.loadMore();
    },
  };
}
/** AppDatePipe 'datetime': DEFAULT_DATE_FORMAT then `hh:mm a`, in the viewer's time zone. */
export function localDateTime(iso: string, format?: FormatSettings) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const hours = at.getHours() % 12 || 12;
  return `${functions.format.dateDisplay(day, format)} ${pad(hours)}:${pad(at.getMinutes())} ${at.getHours() < 12 ? "AM" : "PM"}`;
}
/** The dashboard's Notifications tab. Unlike the bell popup, it never marks anything read (as in the original). */
export function NotificationsPanel({ format }: { format?: FormatSettings }) {
  const { pages, failure, loading, retry, onScroll } = useScrollPages(
    home.notificationPages,
    40,
  );
  const rows = pages.flatMap((p) => p.rows);
  return (
    <article id="notifications-panel" className="notification-panel">
      <ul
        id="notifications-list"
        className="notification-list"
        aria-label="Notifications"
        onScroll={onScroll}
      >
        {rows.map((row) => (
          <li key={row.id} id={`notification-${row.id}`} className="enter-rise">
            <span className="notification-avatar">
              <Icon
                name={row.read ? "email" : "email-unread"}
                size={14}
                label={row.read ? "Read message" : "Unread message"}
              />
            </span>
            <div dangerouslySetInnerHTML={{ __html: row.html }} />
            <time dateTime={row.date}>{localDateTime(row.date, format)}</time>
          </li>
        ))}
        {loading && (
          <li className="list-skeleton">
            <ListSkeleton
              label="Loading notifications"
              rows={rows.length ? 1 : 4}
            />
          </li>
        )}
        {!loading && !failure && rows.length === 0 && (
          <li id="notifications-empty" className="list-empty">
            {pages[0]?.empty}
          </li>
        )}
      </ul>
      {failure && (
        <State
          title="Notifications unavailable"
          message={failure.message}
          action={failure.action}
          code={failure.code}
          retry={retry}
        />
      )}
    </article>
  );
}
/** The dashboard's Featured Opportunities on the shared card, loading on scroll; Home's card has no More Info (GN-Angular). */
export function FeaturedPanel({ format }: { format?: FormatSettings }) {
  const { pages, failure, loading, retry, onScroll } = useScrollPages(
    home.featuredPages,
    60,
  );
  const rows = pages.flatMap((p) => p.rows.map((row) => ({ row, page: p })));
  return (
    <article id="featured-panel" className="widget featured-panel">
      <div className="widget-heading">
        <h3>Featured Opportunities</h3>
      </div>
      <ul
        id="featured-list"
        className="featured-opportunities"
        aria-label="Opportunities"
        onScroll={onScroll}
      >
        {pages[0]?.countsUnavailable && (
          <li role="status" className="list-empty">
            Application and proposal counts could not be loaded.
          </li>
        )}
        {rows.map(({ row, page }) => (
          <li key={row.id} id={`featured-${row.id}`} className="enter-rise">
            <OpportunityCard format={format} row={row} card={page.card} />
          </li>
        ))}
        {loading && (
          <li className="list-skeleton">
            <ListSkeleton
              variant="opportunity"
              label="Loading featured opportunities"
              rows={rows.length ? 1 : 3}
            />
          </li>
        )}
        {!loading && !failure && rows.length === 0 && (
          <li id="featured-empty" className="list-empty">
            {pages[0]?.empty}
          </li>
        )}
      </ul>
      {failure && (
        <State
          title="Opportunities unavailable"
          message={failure.message}
          action={failure.action}
          code={failure.code}
          retry={retry}
        />
      )}
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
  const data = useMemo(() => functions.charts.dynamicChartData(chart), [chart]);
  return functions.charts.chartIsEmpty(data) ? (
    <div className="chart-empty" role="status">
      {chart.texts.empty}
    </div>
  ) : (
    // The tile is 150 × rows + 56: less its 8px padding, 28px head and borders.
    <InsightChart
      id={`dynamic-chart-${functions.ids.idPart(chart.id)}-graphic`}
      title={chart.name}
      height={150 * rows + 10}
      showData
      data={data}
    />
  );
}
/** The tile's overflow menu (GN-Angular cdkMenu): Dimension and Link, each behind its RB row. */
function ChartMenu({
  id,
  label,
  dimension,
  onDimension,
  link,
  onLink,
}: {
  id: string;
  label: string;
  dimension?: string;
  onDimension: () => void;
  link?: string;
  onLink: () => void;
}) {
  const items = [
    ...(dimension
      ? [{ key: "dimension", label: dimension, run: onDimension }]
      : []),
    ...(link ? [{ key: "link", label: link, run: onLink }] : []),
  ];
  return <ActionMenu id={id} label={label} items={items} />;
}
const validSize = (cols: string, rows: string) => {
  const c = Number(cols),
    r = Number(rows);
  return (
    cols !== "" &&
    rows !== "" &&
    Number.isInteger(c) &&
    c >= 1 &&
    c <= 12 &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= 3
  );
};
function RemoteChart({
  descriptor,
  organization,
}: {
  descriptor: { id: string; name: string };
  organization?: string;
}) {
  const { data, error, retry } = useApi(home.dynamicChart, {
    id: descriptor.id,
    organization,
  });
  const [dimensionOpen, setDimensionOpen] = useState(false),
    base = `dynamic-chart-${functions.ids.idPart(descriptor.id)}`;
  const [dimensions, setDimensions] = useState<{
      columns: number;
      rows: number;
    }>(),
    [draft, setDraft] = useState({ cols: "", rows: "" }),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    saving = isActive("dimensions");
  const chart = data?.[0];
  const columns = dimensions?.columns || chart?.columns || 4,
    rows = dimensions?.rows || chart?.rows || 1;
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validSize(draft.cols, draft.rows)) return;
    run(async () => {
      const r = await home.saveChartDimensions(
        descriptor.id,
        Number(draft.cols),
        Number(draft.rows),
      );
      if (!r.ok) {
        if (isOffline(r))
          toast.error({
            message: "Dimensions could not be saved. Please retry.",
          });
        // Writes switched off (D27) are information, as GN-Angular shows them.
        else if (r.error.code === "WRITES_DISABLED")
          toast.show("info", r.error.message);
        else toast.error(r.error);
        return;
      }
      setDimensions(r.data);
      setDimensionOpen(false);
    }, "dimensions");
  };
  const openDimension = () => {
    setDraft({ cols: String(columns), rows: String(rows) });
    setDimensionOpen(true);
  };
  return (
    <section
      id={base}
      className="dynamic-chart-tile enter-rise"
      style={{ flexBasis: `${(columns / 12) * 100}%` }}
    >
      <article
        id={`${base}-card`}
        className="dynamic-chart-card"
        style={{ height: 150 * rows + 56 }}
      >
        <div className="dynamic-chart-head">
          <h3>{chart?.name ?? descriptor.name}</h3>
          {chart && (chart.dimensions || chart.reportUrl) && (
            <ChartMenu
              id={`${base}-menu`}
              label={chart.texts.options}
              dimension={chart.dimensions ? chart.texts.dimension : undefined}
              onDimension={openDimension}
              link={chart.reportUrl ? chart.texts.link : undefined}
              onLink={() => window.open(chart.reportUrl, "_blank", "noopener")}
            />
          )}
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
          data.map((c) => <ChartGraphic key={c.id} chart={c} rows={rows} />)
        )}
      </article>
      {dimensionOpen && (
        <ActionDialog
          id={`${base}-dimension`}
          title={chart?.texts.title ?? "Dimension"}
          className="chart-dimension-dialog"
          busy={saving}
          onClose={() => setDimensionOpen(false)}
        >
          <form id={`${base}-dimension-form`} onSubmit={save}>
            <div className="dimension-fields">
              <label>
                <span>Cols *</span>
                <input
                  id={`${base}-cols`}
                  name="cols"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  required
                  value={draft.cols}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, cols: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Rows *</span>
                <input
                  id={`${base}-rows`}
                  name="rows"
                  type="number"
                  min="1"
                  max="3"
                  step="1"
                  required
                  value={draft.rows}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, rows: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="dialog-actions">
              <button
                id={`${base}-dimension-clear`}
                type="button"
                disabled={saving}
                onClick={() => setDraft({ cols: "", rows: "" })}
              >
                Clear
              </button>
              <button
                id={`${base}-dimension-save`}
                className="primary"
                disabled={saving || !validSize(draft.cols, draft.rows)}
                type="submit"
              >
                {chart?.texts.save ?? "Save"}
              </button>
            </div>
          </form>
        </ActionDialog>
      )}
    </section>
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
        id="dynamic-chart-tabs"
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
      <div
        key={module}
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
      </div>
    </>
  );
}
