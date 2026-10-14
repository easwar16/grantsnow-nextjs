import { Suspense } from "react";
import { pageIdentity } from "@/server/auth/page";
import { requireModule } from "@/server/permissions/policy";
import { opportunityStatistics } from "@/server/opportunities/analytics";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
export const metadata = { title: "Opportunity analytics" };
const colors = [
  "#267db3",
  "#68a341",
  "#ed6647",
  "#8561a8",
  "#e6ab3d",
  "#47b4aa",
];
async function Chart({
  type,
  title,
}: {
  type: "TOP_FUNDERS" | "FUNDING_TYPE";
  title: string;
}) {
  let rows;
  try {
    rows = await opportunityStatistics(type);
  } catch (error) {
    const e = publicError(error);
    return (
      <article className="analytics-panel">
        <h2>{title}</h2>
        <State
          title="Statistics unavailable"
          message={e.message}
          code={e.code}
        />
      </article>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.value)),
    total = rows.reduce((sum, r) => sum + r.value, 0);
  const segments = rows.reduce<{ end: number; stops: string[] }>(
    (acc, row, i) => {
      const end = acc.end + (total ? (row.value / total) * 100 : 0);
      return {
        end,
        stops: [
          ...acc.stops,
          `${colors[i % colors.length]} ${acc.end}% ${end}%`,
        ],
      };
    },
    { end: 0, stops: [] },
  ).stops;
  return (
    <article className="analytics-panel">
      <h2>{title}</h2>
      {!rows.length ? (
        <State title="No statistics returned" />
      ) : type === "TOP_FUNDERS" ? (
        <>
          <div
            className="funding-bars"
            role="img"
            aria-label={`Average funding amount by funder: ${rows.map((r) => `${r.label}: ${r.value}`).join("; ")}`}
          >
            {rows.map((r, i) => (
              <div key={r.id} className="funding-bar-column">
                <strong>
                  {new Intl.NumberFormat("en-GB").format(r.value)}
                </strong>
                <div
                  className="funding-bar"
                  style={{
                    height: `${(r.value / max) * 220}px`,
                    background: colors[i % colors.length],
                  }}
                />
                <span>{r.label}</span>
              </div>
            ))}
          </div>
          <p className="muted">Average funding amount · Funder</p>
        </>
      ) : (
        <div className="funding-pie-layout">
          {total > 0 && (
            <div
              className="funding-pie"
              role="img"
              aria-label={rows.map((r) => `${r.label}: ${r.value}`).join("; ")}
              style={{ background: `conic-gradient(${segments.join(",")})` }}
            />
          )}
          <dl>
            {rows.map((r, i) => (
              <div key={r.id}>
                <dt>
                  <span
                    className="chart-legend-swatch"
                    style={{ background: colors[i % colors.length] }}
                  />
                  {r.label}
                </dt>
                <dd>{new Intl.NumberFormat("en-GB").format(r.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </article>
  );
}
export default async function Analytics() {
  const { user } = await pageIdentity("/opportunities/analytics");
  try {
    requireModule(user, "opportunities-analytics");
  } catch {
    return <State title="Access denied" code="FORBIDDEN" />;
  }
  return (
    <section className="analytics-workspace">
      <h1>Analytics Dashboard</h1>
      <div className="opportunity-analytics-grid">
        {(
          [
            ["TOP_FUNDERS", "Top Funders"],
            ["FUNDING_TYPE", "Opportunities by Funding Type"],
          ] as const
        ).map(([type, title]) => (
          <Suspense key={type} fallback={<State title={`Loading ${title}…`} />}>
            <Chart type={type} title={title} />
          </Suspense>
        ))}
      </div>
    </section>
  );
}
