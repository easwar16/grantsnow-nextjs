import { ChartSkeleton } from "@/components/feedback/skeleton";
export default function Loading() {
  return (
    <section className="analytics-workspace">
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="opportunity-analytics-grid">
        <ChartSkeleton label="Loading Top Funders" />
        <ChartSkeleton label="Loading funding types" />
      </div>
    </section>
  );
}
