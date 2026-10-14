"use client";
import { useState } from "react";
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
}: {
  attention: React.ReactNode;
  insights: React.ReactNode;
  additional: {
    opportunities: boolean;
    notifications: boolean;
    charts: { id: string; name: string; module: string }[];
  };
  organization?: string;
}) {
  const [selected, setSelected] = useState(0);
  const tabs = [
    { label: "Need Attention", icon: "\uf6b3", content: attention },
    { label: "Insights", icon: "\uf6cd", content: insights },
    ...(additional.opportunities
      ? [{ label: "Opportunities", icon: "\uf215", content: <FeaturedPanel /> }]
      : []),
    ...(additional.notifications
      ? [
          {
            label: "Notifications",
            icon: "\uf2f9",
            content: <NotificationsPanel />,
          },
        ]
      : []),
    ...(additional.charts.length
      ? [
          {
            label: "Dynamic Charts",
            icon: "\uf230",
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
            <span
              aria-hidden="true"
              className={`ux-icon ${i === 0 ? "attention-icon" : i === 1 ? "insights-icon" : "success-text"}`}
            >
              {tab.icon}
            </span>
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
