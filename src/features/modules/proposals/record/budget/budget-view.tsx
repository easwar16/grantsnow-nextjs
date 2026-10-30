"use client";

import { useState } from "react";
import type { proposalBudget } from "@/server/modules/proposals/budget";
import { BudgetTree } from "./budget-tree";
import styles from "../proposal-record.module.css";

type Budget = Awaited<ReturnType<typeof proposalBudget>>;
type Column = {
  key:
    | "name"
    | "role"
    | "project-fte"
    | "project-avg-fte"
    | "project-hours"
    | "project-months"
    | "unindexed-cost"
    | "total-cost";
  label: string;
};

export function BudgetView({
  id,
  type,
  projects,
  combinedGroups,
  combinedYearSplits,
  columns,
  canReadStaff,
  versionId,
  showTotal,
  showUnindexed,
  total,
  unindexed,
  currency,
  decimals,
  yearSplitLabel,
  showIndexedYears,
  showUnindexedYears,
}: {
  id: string;
  type: string;
  projects: {
    id: string;
    title: string;
    groups: Budget["groups"];
    total: string | number;
    unindexed: string | number;
    yearSplits: Budget["yearSplits"];
  }[];
  combinedGroups: Budget["groups"];
  combinedYearSplits: Budget["yearSplits"];
  columns: Column[];
  canReadStaff: boolean;
  versionId: number | null;
  showTotal: boolean;
  showUnindexed: boolean;
  total: string | number;
  unindexed: string | number;
  currency: string;
  decimals: number;
  yearSplitLabel: string | null;
  showIndexedYears: boolean;
  showUnindexedYears: boolean;
}) {
  const [view, setView] = useState<"split" | "combined">("split");
  const [showYearSplit, setShowYearSplit] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  const visible =
    view === "combined"
      ? [
          {
            id: "combined",
            title: "Combined View",
            groups: combinedGroups,
            total,
            unindexed,
            yearSplits: combinedYearSplits,
          },
        ]
      : projects;
  return (
    <>
      {yearSplitLabel && (
        <label
          className={styles.budgetYearSplit}
          htmlFor={`proposal-${id}-budget-year-split`}
        >
          {yearSplitLabel}
          <input
            id={`proposal-${id}-budget-year-split`}
            type="checkbox"
            checked={showYearSplit}
            onChange={(event) => setShowYearSplit(event.target.checked)}
          />
        </label>
      )}
      {projects.length > 1 && (
        <div
          id={`proposal-${id}-budget-views`}
          className={styles.budgetViews}
          role="group"
          aria-label="Budget view"
        >
          <button
            id={`proposal-${id}-budget-split`}
            type="button"
            aria-pressed={view === "split"}
            onClick={() => setView("split")}
          >
            Proposal / Sub-Proposal
          </button>
          <button
            id={`proposal-${id}-budget-combined`}
            type="button"
            aria-pressed={view === "combined"}
            onClick={() => setView("combined")}
          >
            Combined View
          </button>
        </div>
      )}
      {visible.map((project) => {
        const expanded = !closed.includes(project.id);
        return (
          <section
            id={`proposal-${id}-budget-project-${project.id}`}
            key={project.id}
            className={styles.budgetProject}
          >
            <h2>
              <button
                id={`proposal-${id}-budget-project-toggle-${project.id}`}
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setClosed((items) =>
                    expanded
                      ? [...items, project.id]
                      : items.filter((item) => item !== project.id),
                  )
                }
              >
                <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>{" "}
                {project.title}
              </button>
            </h2>
            {expanded && (
              <BudgetTree
                id={id}
                treeId={project.id}
                type={type}
                groups={project.groups}
                columns={columns}
                canReadStaff={canReadStaff}
                versionId={versionId}
                total={showTotal ? project.total : ""}
                unindexed={showUnindexed ? project.unindexed : ""}
                currency={currency}
                decimals={decimals}
                yearPeriods={
                  showYearSplit
                    ? project.yearSplits.map((split) => split.period)
                    : []
                }
                showIndexedYears={showIndexedYears}
                showUnindexedYears={showUnindexedYears}
                yearSplits={project.yearSplits}
              />
            )}
          </section>
        );
      })}
    </>
  );
}
