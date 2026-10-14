"use client";
import { useState } from "react";
export function DashboardTabs({
  attention,
  insights,
}: {
  attention: React.ReactNode;
  insights: React.ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <>
      <div
        className="dashboard-tabs"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {["Need Attention", "Insights"].map((label, i) => (
          <button
            key={label}
            role="tab"
            id={`dashboard-tab-${i}`}
            aria-selected={selected === i}
            aria-controls={`dashboard-panel-${i}`}
            tabIndex={selected === i ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = selected === 0 ? 1 : 0;
                setSelected(next);
                document.getElementById(`dashboard-tab-${next}`)?.focus();
              }
            }}
            onClick={() => setSelected(i)}
          >
            <span
              aria-hidden="true"
              className={`ux-icon ${i === 0 ? "attention-icon" : "insights-icon"}`}
            >
              {i === 0 ? "\uf6b3" : "\uf6cd"}
            </span>
            {label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id="dashboard-panel-0"
        aria-labelledby="dashboard-tab-0"
        hidden={selected !== 0}
      >
        {attention}
      </section>
      <section
        role="tabpanel"
        id="dashboard-panel-1"
        aria-labelledby="dashboard-tab-1"
        hidden={selected !== 1}
      >
        {insights}
      </section>
    </>
  );
}
