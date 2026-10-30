"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { proposalBudget } from "@/server/modules/proposals/budget";
import { StaffContact } from "./staff-contact";
import styles from "../proposal-record.module.css";

type Groups = Awaited<ReturnType<typeof proposalBudget>>["groups"];
type ColumnKey =
  | "name"
  | "role"
  | "project-fte"
  | "project-avg-fte"
  | "project-hours"
  | "project-months"
  | "unindexed-cost"
  | "total-cost";

export function BudgetTree({
  id,
  treeId,
  type,
  groups,
  columns,
  canReadStaff,
  versionId,
  total,
  unindexed,
  currency,
  decimals,
  yearPeriods,
  showIndexedYears,
  showUnindexedYears,
  yearSplits,
}: {
  id: string;
  treeId: string;
  type: string;
  groups: Groups;
  columns: { key: ColumnKey; label: string }[];
  canReadStaff: boolean;
  versionId: number | null;
  total: string | number;
  unindexed: string | number;
  currency: string;
  decimals: number;
  yearPeriods: string[];
  showIndexedYears: boolean;
  showUnindexedYears: boolean;
  yearSplits: {
    period: string;
    unindexed: string | number;
    indexed: string | number;
  }[];
}) {
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [closedCategories, setClosedCategories] = useState<string[]>([]);
  const amount = (value: string | number) => {
    if (value === "") return "";
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals || 2,
        }).format(parsed)
      : String(value);
  };
  const toggle = (
    items: string[],
    key: string,
    set: (items: string[]) => void,
  ) =>
    set(
      items.includes(key)
        ? items.filter((item) => item !== key)
        : [...items, key],
    );
  const hasName = columns.some((column) => column.key === "name");
  const hasTotal = columns.some((column) => column.key === "total-cost");
  const splitCells = (splits: typeof yearSplits) =>
    yearPeriods.flatMap((period) => {
      const split = splits.find((item) => item.period === period);
      return [
        ...(showIndexedYears
          ? [<td key={`${period}-indexed`}>{amount(split?.indexed ?? 0)}</td>]
          : []),
        ...(showUnindexedYears
          ? [
              <td key={`${period}-unindexed`}>
                {amount(split?.unindexed ?? 0)}
              </td>,
            ]
          : []),
      ];
    });
  const cells = (
    values: Partial<Record<ColumnKey, string | number>> & {
      yearSplits?: typeof yearSplits;
    },
  ) => [
    ...columns
      .filter((column) => column.key !== "name")
      .flatMap((column) =>
        column.key === "total-cost"
          ? [
              ...splitCells(values.yearSplits ?? []),
              <td key={column.key}>{amount(values[column.key] ?? "")}</td>,
            ]
          : [
              <td key={column.key}>
                {column.key === "unindexed-cost"
                  ? amount(values[column.key] ?? "")
                  : (values[column.key] ?? "")}
              </td>,
            ],
      ),
    ...(!hasTotal ? splitCells(values.yearSplits ?? []) : []),
  ];

  return (
    <table
      id={`proposal-${id}-budget-tree-${treeId}`}
      className={styles.budgetTable}
    >
      <thead>
        <tr>
          {columns.flatMap((column) => [
            ...(column.key === "total-cost"
              ? yearPeriods.flatMap((period) => [
                  ...(showIndexedYears
                    ? [
                        <th scope="col" key={`${period}-indexed`}>
                          {period} (Indexed)
                        </th>,
                      ]
                    : []),
                  ...(showUnindexedYears
                    ? [
                        <th scope="col" key={`${period}-unindexed`}>
                          {period} (Un-Indexed)
                        </th>,
                      ]
                    : []),
                ])
              : []),
            <th scope="col" key={column.key}>
              {column.label}
            </th>,
          ])}
          {!hasTotal &&
            yearPeriods.flatMap((period) => [
              ...(showIndexedYears
                ? [
                    <th scope="col" key={`${period}-indexed`}>
                      {period} (Indexed)
                    </th>,
                  ]
                : []),
              ...(showUnindexedYears
                ? [
                    <th scope="col" key={`${period}-unindexed`}>
                      {period} (Un-Indexed)
                    </th>,
                  ]
                : []),
            ])}
          {canReadStaff && (
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          )}
        </tr>
      </thead>
      {groups.map((group) => {
        const groupClosed = closedGroups.includes(group.id);
        return (
          <tbody
            key={group.id}
            id={`proposal-${id}-budget-funding-${treeId}-${group.id}`}
          >
            <tr className={styles.budgetGroupRow}>
              {hasName && (
                <th scope="row">
                  <button
                    type="button"
                    id={`proposal-${id}-budget-funding-toggle-${treeId}-${group.id}`}
                    aria-expanded={!groupClosed}
                    onClick={() =>
                      toggle(closedGroups, group.id, setClosedGroups)
                    }
                  >
                    <Icon
                      name={groupClosed ? "chevron-right" : "chevron-down"}
                    />
                    {group.name}
                  </button>
                </th>
              )}
              {cells({
                "unindexed-cost": group.unindexed,
                "total-cost": group.total,
                yearSplits: group.yearSplits,
              })}
              {canReadStaff && <td />}
            </tr>
            {!groupClosed &&
              group.categories.flatMap((category) => {
                const categoryKey = `${group.id}-${category.id}`;
                const categoryClosed = closedCategories.includes(categoryKey);
                return [
                  <tr
                    id={`proposal-${id}-budget-category-${treeId}-${categoryKey}`}
                    className={styles.budgetCategoryRow}
                    key={categoryKey}
                  >
                    {hasName && (
                      <th scope="row">
                        <button
                          type="button"
                          id={`proposal-${id}-budget-category-toggle-${treeId}-${categoryKey}`}
                          aria-expanded={!categoryClosed}
                          onClick={() =>
                            toggle(
                              closedCategories,
                              categoryKey,
                              setClosedCategories,
                            )
                          }
                        >
                          <Icon
                            name={
                              categoryClosed ? "chevron-right" : "chevron-down"
                            }
                          />
                          {category.name}
                        </button>
                      </th>
                    )}
                    {cells({
                      "unindexed-cost": category.unindexed,
                      "total-cost": category.total,
                      yearSplits: category.yearSplits,
                    })}
                    {canReadStaff && <td />}
                  </tr>,
                  ...(!categoryClosed
                    ? category.rows.map((row) => (
                        <tr
                          id={`proposal-${id}-budget-line-${treeId}-${row.id}`}
                          key={`${categoryKey}-${row.id}`}
                          className={styles.budgetLineRow}
                        >
                          {hasName && (
                            <td>
                              {category.code === "STAFF" &&
                              canReadStaff &&
                              /^\d+$/.test(row.id) ? (
                                <StaffContact
                                  type={type}
                                  id={id}
                                  costHeaderId={row.id}
                                  versionId={versionId}
                                  name={row.name}
                                />
                              ) : (
                                row.name
                              )}
                            </td>
                          )}
                          {cells({
                            role: row.role,
                            "project-fte": row.fte,
                            "project-avg-fte": row.averageFte,
                            "project-hours": row.hours,
                            "project-months": row.months,
                            "unindexed-cost": row.unindexed,
                            "total-cost": row.total,
                            yearSplits: row.yearSplits,
                          })}
                          {canReadStaff && (
                            <td>
                              {category.code === "STAFF" &&
                                /^\d+$/.test(row.id) && (
                                  <Link
                                    id={`proposal-${id}-budget-staff-${row.id}`}
                                    href={`/proposals/${type}/${id}/budget/staff/${row.id}${versionId ? `?version=${versionId}` : ""}`}
                                    prefetch={false}
                                  >
                                    View cost
                                  </Link>
                                )}
                            </td>
                          )}
                        </tr>
                      ))
                    : []),
                ];
              })}
          </tbody>
        );
      })}
      <tfoot>
        <tr>
          {hasName && <th scope="row">Total</th>}
          {cells({
            "unindexed-cost": unindexed,
            "total-cost": total,
            yearSplits,
          })}
          {canReadStaff && <td />}
        </tr>
      </tfoot>
    </table>
  );
}
