import type { Kpi } from "@/server/home/kpis";
import { sparklineSegments } from "../sparkline";
import { Icon } from "@/components/ui/icon";
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
        const segments = sparklineSegments(
          k.trendChart?.data.map((r) => r.value) ?? [],
        );
        return (
          <article key={k.id}>
            <div className="kpi-title">
              <strong>{k.title}</strong>
              {segments.length > 0 && (
                <svg
                  width="60"
                  height="16"
                  viewBox="0 0 60 16"
                  aria-hidden="true"
                >
                  {segments.map((s) => (
                    // Legacy redwood-overrides .kpi-spark-line / .kpi-spark-area.
                    <g key={s.from}>
                      <polygon
                        points={`${s.from},12 ${s.points} ${s.to},12`}
                        style={{ fill: "var(--spark)" }}
                        fillOpacity="0.15"
                      />
                      <polyline
                        points={s.points}
                        style={{ stroke: "var(--spark)" }}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </g>
                  ))}
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
                  <Icon
                    name={
                      k.periodChangeIndicator.value < 0
                        ? "arrow-down"
                        : "arrow-up"
                    }
                    label={k.periodChangeIndicator.value < 0 ? "Down" : "Up"}
                    size={12}
                  />{" "}
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
