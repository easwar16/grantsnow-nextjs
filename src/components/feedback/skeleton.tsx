/** Geometry-only placeholders: never show fabricated records or metrics. */
export function RecordSkeleton({
  label = "Loading records",
  rows = 3,
  variant = "attention",
}: {
  label?: string;
  rows?: number;
  variant?: "attention" | "proposal" | "opportunity";
}) {
  return (
    <div
      className={`record-skeleton skeleton-${variant}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton-record" key={i}>
            <span className="skeleton skeleton-reference" />
            <span className="skeleton skeleton-title" />
            <div className="skeleton-metadata">
              {Array.from({ length: 5 }, (_, j) => (
                <span className="skeleton" key={j} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ChartSkeleton({ label = "Loading chart" }: { label?: string }) {
  return (
    <div
      className="chart-skeleton"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div className="skeleton-chart-plot" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton-tab-row" aria-hidden="true">
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    </div>
  );
}
export function TableSkeleton({ label = "Loading table" }: { label?: string }) {
  return (
    <div
      className="table-skeleton"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <div className="skeleton-table-row" key={i}>
            {Array.from({ length: 5 }, (_, j) => (
              <span className="skeleton" key={j} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
export function KpiSkeleton() {
  return (
    <section
      className="kpi-strip"
      role="status"
      aria-busy="true"
      aria-label="Loading key performance indicators"
    >
      <span className="sr-only">Loading key performance indicators</span>
      {Array.from({ length: 4 }, (_, i) => (
        <article aria-hidden="true" key={i}>
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-reference" />
          <span className="skeleton skeleton-reference" />
        </article>
      ))}
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
      className="record-workspace"
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
            <div className="summary-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div className="summary-field" key={i}>
                  <span className="skeleton skeleton-reference" />
                  <span className="skeleton skeleton-title" />
                </div>
              ))}
            </div>
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
      <RecordSkeleton label="Loading dashboard" />
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
        {Array.from({ length: 6 }, (_, i) => (
          <span className="skeleton skeleton-title" key={i} />
        ))}
      </aside>
      <div>
        <div className="skeleton-toolbar" aria-hidden="true">
          <span className="skeleton" />
        </div>
        <RecordSkeleton label={label} rows={5} />
      </div>
    </div>
  );
}
