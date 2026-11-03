/** Geometry-only placeholders: never show fabricated records or metrics. */
export type SkeletonKind =
  "lines" | "list" | "chart" | "table" | "cards" | "page";
// Fixed, varied widths so text lines look like text without changing between renders.
const LINE_WIDTHS = [100, 86, 94, 72, 80];
const DEFAULT_COUNT: Record<SkeletonKind, number> = {
  lines: 3,
  list: 3,
  chart: 0,
  table: 7,
  cards: 4,
  page: 3,
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
function RecordBones() {
  return (
    <div className="skeleton-record">
      <span className="skeleton skeleton-reference" />
      <span className="skeleton skeleton-title" />
      <div className="skeleton-metadata">
        {range(5).map((j) => (
          <span className="skeleton" key={j} />
        ))}
      </div>
    </div>
  );
}
function Cards({ count }: { count: number }) {
  return (
    <div className="skeleton-cards">
      {range(count).map((i) => (
        <div className="skeleton-card" key={i}>
          <span className="skeleton" style={{ width: "60%" }} />
          <span className="skeleton skeleton-value" />
          <span className="skeleton" style={{ width: "30%" }} />
        </div>
      ))}
    </div>
  );
}
function Bones({ kind, count }: { kind: SkeletonKind; count: number }) {
  switch (kind) {
    case "lines":
      return range(count).map((i) => (
        <span
          className="skeleton"
          key={i}
          style={{ width: `${LINE_WIDTHS[i % LINE_WIDTHS.length]}%` }}
        />
      ));
    case "list":
      return range(count).map((i) => <RecordBones key={i} />);
    case "chart":
      return (
        <>
          <div className="skeleton-chart-plot">
            {range(6).map((i) => (
              <span className="skeleton" key={i} />
            ))}
          </div>
          <div className="skeleton-tab-row">
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        </>
      );
    case "table":
      return range(count).map((i) => (
        <div className="skeleton-table-row" key={i}>
          {range(5).map((j) => (
            <span className="skeleton" key={j} />
          ))}
        </div>
      ));
    case "cards":
      return <Cards count={count} />;
    case "page":
      return (
        <>
          <div className="skeleton-page-head" />
          <div className="skeleton-page-body">
            <span className="skeleton skeleton-title" />
            <Cards count={4} />
            {range(count).map((i) => (
              <RecordBones key={i} />
            ))}
          </div>
        </>
      );
  }
}
/**
 * The one loading placeholder (D30). Kinds: `lines` (text), `list` (record rows), `chart` (bars),
 * `table` (rows of cells), `cards` (KPI tiles), `page` (brand header + body, only outside the shell).
 * It is a `role="status"` region with `aria-busy` and a visually hidden label; its host is positioned
 * so that label cannot escape a scrolling list (D35). Bones are tints of `currentColor`.
 */
export function Skeleton({
  kind = "lines",
  count,
  label = "Loading",
  className,
}: {
  kind?: SkeletonKind;
  /** Lines, rows or cards to draw. */
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-host skeleton-${kind}${className ? ` ${className}` : ""}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <Bones kind={kind} count={count ?? DEFAULT_COUNT[kind]} />
      </div>
    </div>
  );
}
/**
 * Which skeleton where (owner, 2026-10-29): a placeholder has the shape of what replaces it.
 * - A listing page (`(list)/loading.tsx`): `ListingSkeleton`. A list of record rows or cards: `ListSkeleton`.
 * - A record page above its layout (`(record)/loading.tsx`): `DetailSkeleton` (header, tabs, fields).
 * - A record's tab or section: the shape of its content: `FormSkeleton` (fields), `TableSkeleton`, `ChartSkeleton`,
 *   `KpiSkeleton`, `ListSkeleton`.
 */
export function ListSkeleton({
  label = "Loading records",
  rows = 3,
  variant = "attention",
}: {
  label?: string;
  rows?: number;
  variant?: "attention" | "proposal" | "opportunity";
}) {
  return (
    <Skeleton
      kind="list"
      count={rows}
      label={label}
      className={`record-skeleton skeleton-${variant}`}
    />
  );
}
export function ChartSkeleton({ label = "Loading chart" }: { label?: string }) {
  return <Skeleton kind="chart" label={label} className="chart-skeleton" />;
}
export function TableSkeleton({ label = "Loading table" }: { label?: string }) {
  return <Skeleton kind="table" label={label} className="table-skeleton" />;
}
export function KpiSkeleton() {
  return (
    <section
      className="kpi-strip skeleton-host"
      role="status"
      aria-busy="true"
      aria-label="Loading key performance indicators"
    >
      <span className="sr-only">Loading key performance indicators</span>
      {range(4).map((i) => (
        <article aria-hidden="true" key={i}>
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-reference" />
          <span className="skeleton skeleton-reference" />
        </article>
      ))}
    </section>
  );
}
function FieldBones({ count = 8 }: { count?: number }) {
  return (
    <div className="summary-grid">
      {range(count).map((i) => (
        <div className="summary-field" key={i}>
          <span className="skeleton skeleton-reference" />
          <span className="skeleton skeleton-title" />
        </div>
      ))}
    </div>
  );
}
/** A form or read-only section: label-value pairs in the form's grid. */
export function FormSkeleton({
  label = "Loading details",
  fields = 8,
}: {
  label?: string;
  fields?: number;
}) {
  return (
    <section
      className="skeleton-host"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <FieldBones count={fields} />
      </div>
    </section>
  );
}
export function DetailSkeleton({
  label = "Loading record details",
}: {
  label?: string;
}) {
  return (
    <section
      className="record-workspace skeleton-host"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="record-header">
          <span className="skeleton skeleton-reference" />
          <span className="skeleton skeleton-title" />
        </div>
        <div className="record-body">
          <nav>
            <span className="skeleton skeleton-reference" />
          </nav>
          <div className="summary-panel">
            <FieldBones />
          </div>
        </div>
      </div>
    </section>
  );
}
export function HomeSkeleton() {
  return (
    <div className="home-page-skeleton">
      <div className="announcement-skeleton" aria-hidden="true">
        <span className="skeleton skeleton-title" />
      </div>
      <div className="home-context" aria-hidden="true">
        <span className="skeleton skeleton-title" />
      </div>
      <KpiSkeleton />
      <div className="skeleton-tab-row" aria-hidden="true">
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
      <ListSkeleton label="Loading dashboard" />
    </div>
  );
}
export function ListingSkeleton({
  label = "Loading proposals",
}: {
  label?: string;
}) {
  return (
    <div className="listing-page-skeleton">
      <aside aria-hidden="true">
        {range(6).map((i) => (
          <span className="skeleton skeleton-title" key={i} />
        ))}
      </aside>
      <div>
        <div className="skeleton-toolbar" aria-hidden="true">
          <span className="skeleton" />
        </div>
        <ListSkeleton label={label} rows={5} />
      </div>
    </div>
  );
}
