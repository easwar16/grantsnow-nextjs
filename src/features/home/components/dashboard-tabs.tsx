"use client";
import { idPart } from "@/lib/ids";
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
  labels,
}: {
  /** Null hides the tab: legacy shows a section only when one of its panels is on. */
  attention: React.ReactNode | null;
  insights: React.ReactNode | null;
  additional: {
    opportunities: boolean;
    notifications: boolean;
    charts: { id: string; name: string; module: string }[];
  };
  organization?: string;
  format?: FormatSettings;
  /** RB `button-labels.*` tab names. */
  labels: Record<
    | "needAttention"
    | "insights"
    | "opportunities"
    | "notifications"
    | "dynamicCharts",
    string
  >;
}) {
  const [selected, setSelected] = useState(0);
  const tabs: {
    key: string;
    label: string;
    icon: IconName;
    tone: string;
    content: React.ReactNode;
  }[] = [
    ...(attention === null
      ? []
      : [
          {
            key: "need-attention",
            label: labels.needAttention,
            icon: "flag" as const,
            tone: "danger",
            content: attention,
          },
        ]),
    ...(insights === null
      ? []
      : [
          {
            key: "insights",
            label: labels.insights,
            icon: "chart" as const,
            tone: "warning",
            content: insights,
          },
        ]),
    ...(additional.opportunities
      ? [
          {
            key: "opportunities",
            label: labels.opportunities,
            icon: "money" as const,
            tone: "success",
            content: <FeaturedPanel format={format} />,
          },
        ]
      : []),
    ...(additional.notifications
      ? [
          {
            key: "notifications",
            label: labels.notifications,
            icon: "bell" as const,
            tone: "success",
            content: <NotificationsPanel format={format} />,
          },
        ]
      : []),
    ...(additional.charts.length
      ? [
          {
            key: "dynamic-charts",
            label: labels.dynamicCharts,
            icon: "dynamic" as const,
            tone: "success",
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
  if (!tabs.length) return null;
  const active = Math.min(selected, tabs.length - 1);
  return (
    <>
      <div
        id="home-tabs"
        className="dashboard-tabs"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.icon}
            role="tab"
            id={`home-tab-${idPart(tab.key)}`}
            aria-selected={active === i}
            aria-controls={`home-panel-${idPart(tab.key)}`}
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
                document
                  .getElementById(`home-tab-${idPart(tabs[next].key)}`)
                  ?.focus();
              }
            }}
            onClick={() => setSelected(i)}
          >
            <Icon name={tab.icon} className={`tab-${tab.tone}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <section
          key={tab.icon}
          role="tabpanel"
          id={`home-panel-${idPart(tab.key)}`}
          aria-labelledby={`home-tab-${idPart(tab.key)}`}
          hidden={active !== i}
        >
          {/* The first tab stays mounted so its queues keep their loaded pages. */}
          {i === 0 || active === i ? tab.content : null}
        </section>
      ))}
    </>
  );
}
