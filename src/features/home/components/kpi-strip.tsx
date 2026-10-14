import type { Kpi } from "@/server/home/kpis";
export function KpiStrip({ items, error }: { items: Kpi[]; error?: string }) {
  if (error)
    return (
      <section
        className="kpi-error"
        role="status"
        aria-label="Key performance indicators unavailable"
      >
        <p>{error}</p>
        <a href="/home">Retry dashboard</a>
      </section>
    );
  if (!items.length) return null;
  return (
    <section className="kpi-strip" aria-label="Key performance indicators">
      {items.map((k) => {
        const values =
          k.trendChart?.data.map((r) => Number(r.value) || 0) || [];
        const min = Math.min(...values),
          max = Math.max(...values),
          range = max - min;
        const points = values
          .map(
            (v, i) =>
              `${values.length === 1 ? 30 : (i / (values.length - 1)) * 60},${range === 0 ? 8 : 12 - ((v - min) / range) * 8}`,
          )
          .join(" ");
        return (
          <article key={k.id}>
            <div className="kpi-title">
              <strong>{k.title}</strong>
              {values.length > 0 && (
                <svg
                  width="60"
                  height="16"
                  viewBox="0 0 60 16"
                  aria-hidden="true"
                >
                  <polygon points={`0,12 ${points} 60,12`} fill="#e0e4ec" />
                  <polyline
                    points={points}
                    stroke="#245dbb"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </svg>
              )}
            </div>
            <div className="kpi-value">
              {k.metric !== null &&
                k.metric !== "" &&
                k.metric !== undefined && <strong>{k.metric}</strong>}
              {k.periodChangeIndicator && (
                <span
                  className={
                    k.trendColor === "danger" ||
                    k.periodChangeIndicator.value < 0
                      ? "danger-text"
                      : "success-text"
                  }
                >
                  {k.periodChangeIndicator.value < 0 ? "↓" : "↑"}{" "}
                  {Math.abs(k.periodChangeIndicator.value)}%{" "}
                  {k.periodChangeIndicator.comparisonPeriod}
                </span>
              )}
            </div>
            <small>{k.meta}</small>
          </article>
        );
      })}
    </section>
  );
}
