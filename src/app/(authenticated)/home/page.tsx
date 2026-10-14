import { InsightWidget } from "@/features/home/components/insight-widget";
import { dashboardTabs } from "@/server/home/extra-tabs";
import { OrganizationHeading } from "@/features/home/components/organization-heading";
import { Announcements } from "@/features/home/components/announcements";
import { loadAnnouncements } from "@/server/home/announcements";
import { DashboardTabs } from "@/features/home/components/dashboard-tabs";
import { KpiStrip } from "@/features/home/components/kpi-strip";
import { loadKpis } from "@/server/home/kpis";
import Link from "next/link";
import { Suspense } from "react";
import { pageIdentity } from "@/server/auth/page";
import {
  enabledWidgets,
  homeAccess,
  widgetResult,
} from "@/server/home/service";
import { homeFilters } from "@/features/home/schemas";
import { organizations } from "@/server/configuration/service";
import { HomeFilterControls } from "@/features/home/components/filters";
import { Widget } from "@/features/home/components/widget";
import type { HomeFilters } from "@/features/home/types";
import { AppError } from "@/lib/errors";
import { RecordSkeleton, KpiSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
export const metadata = { title: "Home" };
async function LoadedKpis({ organization }: { organization?: string }) {
  return <KpiStrip {...await loadKpis(organization)} />;
}
async function LoadedWidget({
  id,
  title,
  filters,
  insight,
  columns,
}: {
  id: string;
  title: string;
  filters: HomeFilters;
  insight: boolean;
  columns: number;
}) {
  return (
    <Widget
      id={id}
      title={title}
      initial={await widgetResult(id, filters)}
      filters={filters}
      insight={insight}
      columns={columns}
    />
  );
}
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/home");
  try {
    await homeAccess();
  } catch (e) {
    if (e instanceof AppError && e.status === 403)
      return (
        <State
          title="Access denied"
          message="Home read access has not been granted."
          code="FORBIDDEN"
        />
      );
    throw e;
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams))
    if (typeof v === "string" && v) params.set(k, v);
  let filters;
  try {
    filters = homeFilters(params);
    filters.organization ||= user.organizationId;
  } catch {
    return (
      <>
        <State title="Invalid dashboard filters" code="BAD_REQUEST" />
        <Link className="button" href="/home">
          Reset dashboard filters
        </Link>
      </>
    );
  }
  const enabled = await enabledWidgets();
  const orgs = await organizations();
  const additionalTabs = await dashboardTabs();
  const panels = (["needAttention", "insights"] as const).map((section) => (
    <div
      key={section}
      className={
        section === "needAttention" ? "attention-panels" : "insight-panels"
      }
    >
      {enabled
        .filter((w) => w.section === section)
        .map((w) =>
          section === "insights" ? (
            <InsightWidget
              key={`${w.id}:${params.toString()}`}
              id={w.id}
              title={w.title}
              filters={filters}
              columns={w.columns || 6}
            />
          ) : (
            <Suspense
              key={`${w.id}:${params.toString()}`}
              fallback={
                <article className="widget">
                  <h3>{w.title}</h3>
                  <RecordSkeleton label={`Loading ${w.title}`} />
                </article>
              }
            >
              <LoadedWidget
                id={w.id}
                title={w.title}
                filters={filters}
                insight={false}
                columns={6}
              />
            </Suspense>
          ),
        )}
      {!enabled.some((w) => w.section === section) && (
        <State title="No widgets enabled" />
      )}
    </div>
  ));
  return (
    <>
      <Announcements {...await loadAnnouncements()} />
      <div className="home-context">
        <OrganizationHeading
          organizations={orgs}
          selected={filters.organization}
          fallback={user.organization}
        />
        <span className="sr-only">Welcome, {user.name.split(" ")[0]}.</span>
        <Link className="sr-only" href="/proposals" prefetch={false}>
          View Proposals
        </Link>
      </div>
      <Suspense key={filters.organization} fallback={<KpiSkeleton />}>
        <LoadedKpis organization={filters.organization} />
      </Suspense>
      <DashboardTabs
        additional={additionalTabs}
        organization={filters.organization}
        attention={panels[0]}
        insights={
          <>
            <HomeFilterControls currentYear={new Date().getFullYear()} />
            {panels[1]}
          </>
        }
      />
    </>
  );
}
