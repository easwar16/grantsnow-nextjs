import { Suspense } from "react";
import { ChartSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { InsightChart } from "@/features/modules/home/components/insight-chart";
import { functions } from "@/lib/functions";
import type { StatisticRow } from "@/features/modules/home/types";

/** One legacy oj-chart: Top Funders as one bar series (no legend, y-axis titled), Funding Type as a pie with legend. */
async function Chart({
  kind,
  title,
  yTitle,
  legendTitle,
  read,
}: {
  kind: "top-funders" | "funding-type";
  title: string;
  yTitle: string;
  legendTitle: string;
  read: Promise<StatisticRow[]>;
}) {
  const id = `opportunity-analytics-${kind}`;
  let rows;
  try {
    rows = await read;
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <article id={id} className="analytics-panel">
        <h2 id={`${id}-title`}>{title}</h2>
        <State
          title="Statistics unavailable"
          message={e.message}
          action={e.action}
          code={e.code}
        />
      </article>
    );
  }
  return (
    <article id={id} className="analytics-panel">
      <h2 id={`${id}-title`}>{title}</h2>
      {rows.length === 0 ? (
        <State title="No data to display" />
      ) : (
        <InsightChart
          id={`${id}-chart`}
          title={title}
          data={{
            attention: [],
            statistics: rows,
            hasMore: false,
            offset: 0,
            presentation:
              kind === "top-funders"
                ? {
                    type: "bar",
                    columns: 6,
                    yTitle,
                    legend: false,
                    rotateLabels: true,
                  }
                : {
                    type: "pie",
                    columns: 6,
                    legend: true,
                    insideLabels: true,
                    legendTitle,
                  },
          }}
        />
      )}
    </article>
  );
}

/** Legacy opportunities-analytics-page: the dashboard's two panels, each streaming in on its own read. */
export function AnalyticsDashboard({
  texts,
  topFunders,
  fundingType,
}: {
  texts: {
    title: string;
    topFunders: string;
    averageAmount: string;
    byFundingType: string;
    fundingType: string;
  };
  topFunders: Promise<StatisticRow[]>;
  fundingType: Promise<StatisticRow[]>;
}) {
  const charts = [
    ["top-funders", texts.topFunders, topFunders],
    ["funding-type", texts.byFundingType, fundingType],
  ] as const;
  return (
    <section id="opportunity-analytics" className="analytics-workspace">
      <h1 id="opportunity-analytics-title">{texts.title}</h1>
      <div
        id="opportunity-analytics-grid"
        className="opportunity-analytics-grid"
      >
        {charts.map(([kind, title, read]) => (
          <Suspense
            key={kind}
            fallback={<ChartSkeleton label={`Loading ${title}`} />}
          >
            <Chart
              kind={kind}
              title={title}
              yTitle={texts.averageAmount}
              legendTitle={texts.fundingType}
              read={read}
            />
          </Suspense>
        ))}
      </div>
    </section>
  );
}
