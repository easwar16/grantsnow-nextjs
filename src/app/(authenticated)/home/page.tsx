import { InsightWidget } from "@/features/modules/home/components/insight-widget";
import { dashboardTabs } from "@/server/modules/home/extra-tabs";
import { OrganizationHeading } from "@/features/modules/home/components/organization-heading";
import { Announcements } from "@/features/modules/home/components/announcements";
import { loadAnnouncements } from "@/server/modules/home/announcements";
import { DashboardTabs } from "@/features/modules/home/components/dashboard-tabs";
import { KpiStrip } from "@/features/modules/home/components/kpi-strip";
import { loadKpis } from "@/server/modules/home/kpis";
import Link from "next/link";
import { Suspense } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import {
  enabledWidgets,
  homeAccess,
  widgetResult,
} from "@/server/modules/home/service";
import { homeFilters } from "@/features/modules/home/schemas";
import { organizations } from "@/server/platform/configuration/service";
import { HomeFilterControls } from "@/features/modules/home/components/filters";
import { Widget } from "@/features/modules/home/components/widget";
import type { HomeFilters } from "@/features/modules/home/types";
import { AppError } from "@/lib/errors";
import { type FormatSettings } from "@/lib/format";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { ListSkeleton, KpiSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import type { WidgetLabels } from "@/features/modules/home/components/widget";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
export const metadata = { title: "Home" };
/** A dashboard RB entry by its `<group>.<name>` key. */
const dashboardKey = (key: string) => {
  const dot = key.indexOf(".");
  return [key.slice(0, dot), key.slice(dot + 1)] as const;
};
const dashboardLabel = (rows: Resources, key: string, fallback: string) =>
  serverFunctions.resources.label(
    rows,
    "dashboard",
    ...dashboardKey(key),
    fallback,
  );
const dashboardHelp = (rows: Resources, key: string) =>
  serverFunctions.resources.resourceDescription(
    rows,
    "dashboard",
    ...dashboardKey(key),
  );
async function LoadedKpis({ organization }: { organization?: string }) {
  return <KpiStrip {...await loadKpis(organization)} />;
}
async function LoadedWidget({
  id,
  title,
  help,
  labels,
  filters,
  format,
}: {
  id: string;
  title: string;
  help: string | null;
  labels: WidgetLabels;
  filters: HomeFilters;
  format?: FormatSettings;
}) {
  return (
    <Widget
      id={id}
      title={title}
      help={help}
      labels={labels}
      initial={await widgetResult(id, filters)}
      filters={filters}
      format={format}
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
          id="home-access-denied"
          title="Access denied"
          message="Your session does not permit access to Home."
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
        <State
          id="home-invalid-filters"
          title="Invalid dashboard filters"
          code="BAD_REQUEST"
        />
        <Link id="home-filters-reset" className="button" href="/home">
          Reset dashboard filters
        </Link>
      </>
    );
  }
  // Independent reads start together; announcements handle their own failure.
  const [enabled, orgs, additionalTabs, format, rb, announcements] =
    await Promise.all([
      enabledWidgets(),
      organizations(),
      dashboardTabs(),
      displayFormat(),
      resources(),
      loadAnnouncements(),
    ]);
  const empty = dashboardLabel(
    rb,
    "helper-texts.no-data",
    "No data to display.",
  );
  const widgetLabels: WidgetLabels = {
    list: dashboardLabel(rb, "labels.dashboard-list-view", "List View"),
    // Legacy shows Calendar View only when its RB row is visible.
    calendar: serverFunctions.resources.resourceVisible(
      rb,
      "dashboard",
      "labels",
      "dashboard-calendar-view",
    )
      ? dashboardLabel(rb, "labels.dashboard-calendar-view", "Calendar View")
      : undefined,
    empty,
    denied: {
      summary: dashboardLabel(
        rb,
        "error-msg.access-not-granted",
        "Access not Granted",
      ),
      detail: "Please Contact your System Admin",
    },
  };
  const panels = (["needAttention", "insights"] as const).map((section) => {
    const shown = enabled.filter((w) => w.section === section);
    if (!shown.length) return null;
    return (
      <div
        key={section}
        id={
          section === "needAttention" ? "home-need-attention" : "home-insights"
        }
        className={
          section === "needAttention" ? "attention-panels" : "insight-panels"
        }
      >
        {shown.map((w) => {
          const title = dashboardLabel(rb, w.labelKey, w.title),
            help = dashboardHelp(rb, w.labelKey);
          return section === "insights" ? (
            <InsightWidget
              key={`${w.id}:${params.toString()}`}
              id={w.id}
              title={title}
              help={help}
              empty={empty}
              filters={filters}
              columns={w.columns || 6}
              format={format}
            />
          ) : (
            <Suspense
              key={`${w.id}:${params.toString()}`}
              fallback={
                <article
                  id={`home-widget-${functions.ids.idPart(w.id)}-loading`}
                  className="attention-widget"
                >
                  <div className="attention-content">
                    <div className="attention-head">
                      <h3>{title}</h3>
                    </div>
                    <ListSkeleton label={`Loading ${title}`} />
                  </div>
                </article>
              }
            >
              <LoadedWidget
                id={w.id}
                title={title}
                help={help}
                labels={widgetLabels}
                filters={filters}
                format={format}
              />
            </Suspense>
          );
        })}
      </div>
    );
  });
  return (
    <>
      <Announcements
        id="home-announcements"
        title={dashboardLabel(rb, "labels.announcements", "Announcements")}
        {...announcements}
      />
      <div id="home-heading" className="home-heading">
        <OrganizationHeading
          organizations={orgs}
          selected={filters.organization}
          fallback={user.organization}
        />
        <span className="sr-only">Welcome, {user.name.split(" ")[0]}.</span>
        <Link
          id="home-proposals-link"
          className="sr-only"
          href="/proposals"
          prefetch={false}
        >
          View Proposals
        </Link>
      </div>
      <Suspense key={filters.organization} fallback={<KpiSkeleton />}>
        <LoadedKpis organization={filters.organization} />
      </Suspense>
      <DashboardTabs
        additional={additionalTabs}
        organization={filters.organization}
        format={format}
        labels={{
          needAttention: dashboardLabel(
            rb,
            "button-labels.need-attention",
            "Need Attention",
          ),
          insights: dashboardLabel(rb, "button-labels.insights", "Insights"),
          opportunities: dashboardLabel(
            rb,
            "button-labels.opportunities",
            "Opportunities",
          ),
          notifications: dashboardLabel(
            rb,
            "button-labels.notifications",
            "Notifications",
          ),
          dynamicCharts: dashboardLabel(
            rb,
            "button-labels.dynamic-charts",
            "Dynamic Charts",
          ),
        }}
        attention={panels[0]}
        insights={
          panels[1] && (
            <>
              <HomeFilterControls
                currentYear={new Date().getFullYear()}
                labels={{
                  year: dashboardLabel(rb, "labels.years", "Years"),
                  quarter: dashboardLabel(rb, "labels.quarter", "Quarter"),
                  month: dashboardLabel(rb, "labels.months", "Months"),
                }}
              />
              {panels[1]}
            </>
          )
        }
      />
      {panels.every((p) => p === null) &&
        !additionalTabs.opportunities &&
        !additionalTabs.notifications &&
        !additionalTabs.charts.length && (
          <p id="home-empty" className="dashboard-empty">
            {empty}
          </p>
        )}
    </>
  );
}
