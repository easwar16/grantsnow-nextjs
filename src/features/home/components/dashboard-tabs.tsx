"use client";
import { useState } from "react";
import type { FormatSettings } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  DynamicChartsPanel,
  FeaturedPanel,
  NotificationsPanel,
} from "./remote-tabs";
export function DashboardTabs({
  attention,
  insights,
  additional,
  organization,
  format,
}: {
  attention: React.ReactNode;
  insights: React.ReactNode;
  additional: {
    opportunities: boolean;
    notifications: boolean;
    charts: { id: string; name: string; module: string }[];
  };
  organization?: string;
  format?: FormatSettings;
}) {
  const [selected, setSelected] = useState(0);
  const tabs: { label: string; icon: IconName; content: React.ReactNode }[] = [
    { label: "Need Attention", icon: "flag", content: attention },
    { label: "Insights", icon: "chart", content: insights },
    ...(additional.opportunities
      ? [
          {
            label: "Opportunities",
            icon: "money" as const,
            content: <FeaturedPanel format={format} />,
          },
        ]
      : []),
    ...(additional.notifications
      ? [
          {
            label: "Notifications",
            icon: "bell" as const,
            content: <NotificationsPanel format={format} />,
          },
        ]
      : []),
    ...(additional.charts.length
      ? [
          {
            label: "Dynamic Charts",
            icon: "dynamic" as const,
            content: (
              <DynamicChartsPanel
                charts={additional.charts}
                organization={organization}
              />
            ),
          },
        ]
      : []),
  ];
  const active = Math.min(selected, tabs.length - 1);
  return (
    <>
      <div
        className="dashboard-tabs"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            id={`dashboard-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`dashboard-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onKeyDown={(event) => {
              let next: number | undefined;
              if (event.key === "ArrowRight") next = (active + 1) % tabs.length;
              if (event.key === "ArrowLeft")
                next = (active + tabs.length - 1) % tabs.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = tabs.length - 1;
              if (next !== undefined) {
                event.preventDefault();
                setSelected(next);
                document.getElementById(`dashboard-tab-${next}`)?.focus();
              }
            }}
            onClick={() => setSelected(i)}
          >
            <Icon
              name={tab.icon}
              className={
                i === 0
                  ? "attention-icon"
                  : i === 1
                    ? "insights-icon"
                    : "success-text"
              }
            />
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <section
          key={tab.label}
          role="tabpanel"
          id={`dashboard-panel-${i}`}
          aria-labelledby={`dashboard-tab-${i}`}
          hidden={active !== i}
        >
          {i === 0 || active === i ? tab.content : null}
        </section>
      ))}
    </>
  );
}
