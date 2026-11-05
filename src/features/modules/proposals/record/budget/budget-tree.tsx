"use client";

import { useRouter } from "next/navigation";
import { ActionMenu } from "@/components/ui/action-menu";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { functions } from "@/lib/functions";
import type { proposalBudget } from "@/server/modules/proposals/budget";
import { StaffContact } from "./staff-contact";
import styles from "../proposal-record.module.css";

type Groups = Awaited<ReturnType<typeof proposalBudget>>["groups"];
type Category = Groups[number]["categories"][number];
type Node =
  | { kind: "group"; group: Groups[number] }
  | { kind: "category"; groupId: string; category: Category }
  | { kind: "line"; category: string; row: Category["rows"][number] };
type ColumnKey =
  | "name"
  | "role"
  | "project-fte"
  | "project-avg-fte"
  | "project-hours"
  | "project-months"
  | "unindexed-cost"
  | "total-cost";
type Values = Partial<Record<ColumnKey, string | number>> & {
  yearSplits?: {
    period: string;
    unindexed: string | number;
    indexed: string | number;
  }[];
};

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
  const router = useRouter();
  const amount = (value: string | number) =>
    value === ""
      ? ""
      : functions.format.moneyDisplay(String(value), currency, { decimals });
  const hasTotal = columns.some((column) => column.key === "total-cost");
  const totals: Values = {
    "unindexed-cost": unindexed,
    "total-cost": total,
    yearSplits,
  };
  const splitColumns = yearPeriods.flatMap((period) => {
    const split = (node: Values) =>
      (node.yearSplits ?? []).find((item) => item.period === period);
    return [
      ...(showIndexedYears
        ? [
            {
              id: `${period}-indexed`,
              header: `${period} (Indexed)`,
              cell: (node: Node) => amount(split(values(node))?.indexed ?? 0),
              footer: amount(split(totals)?.indexed ?? 0),
            },
          ]
        : []),
      ...(showUnindexedYears
        ? [
            {
              id: `${period}-unindexed`,
              header: `${period} (Un-Indexed)`,
              cell: (node: Node) => amount(split(values(node))?.unindexed ?? 0),
              footer: amount(split(totals)?.unindexed ?? 0),
            },
          ]
        : []),
    ];
  });
  const cell = (key: ColumnKey, node: Values) =>
    key === "unindexed-cost" || key === "total-cost"
      ? amount(node[key] ?? "")
      : (node[key] ?? "");
  const tableColumns: TableColumn<Node>[] = [
    ...columns.flatMap((column): TableColumn<Node>[] =>
      column.key === "name"
        ? [
            {
              id: column.key,
              header: column.label,
              cell: (node) =>
                node.kind === "line" &&
                node.category === "STAFF" &&
                canReadStaff &&
                /^\d+$/.test(node.row.id) ? (
                  <StaffContact
                    type={type}
                    id={id}
                    costHeaderId={node.row.id}
                    versionId={versionId}
                    name={node.row.name}
                  />
                ) : (
                  nameOf(node)
                ),
              footer: "Total",
            },
          ]
        : [
            ...(column.key === "total-cost" ? splitColumns : []),
            {
              id: column.key,
              header: column.label,
              cell: (node) => cell(column.key, values(node)),
              footer: cell(column.key, totals),
            },
          ],
    ),
    ...(!hasTotal ? splitColumns : []),
  ];
  const nodes: Node[] = groups.map((group) => ({ kind: "group", group }));

  return (
    <DataTable
      id={`proposal-${id}-budget-tree-${treeId}`}
      rowIds={`proposal-${id}-budget`}
      className={styles.budgetTable}
      columns={tableColumns}
      rows={nodes}
      rowKey={(node) =>
        node.kind === "group"
          ? `funding-${treeId}-${node.group.id}`
          : node.kind === "category"
            ? `category-${treeId}-${node.groupId}-${node.category.id}`
            : `line-${treeId}-${node.row.id}`
      }
      childrenOf={(node) =>
        node.kind === "group"
          ? node.group.categories.map((category) => ({
              kind: "category",
              groupId: node.group.id,
              category,
            }))
          : node.kind === "category"
            ? node.category.rows.map((row) => ({
                kind: "line",
                category: node.category.code,
                row,
              }))
            : undefined
      }
      rowLabel={nameOf}
      rowClassName={(node) =>
        node.kind === "group"
          ? styles.budgetGroupRow
          : node.kind === "category"
            ? styles.budgetCategoryRow
            : styles.budgetLineRow
      }
      actionCell={
        canReadStaff
          ? (node) =>
              node.kind === "line" &&
              node.category === "STAFF" &&
              /^\d+$/.test(node.row.id) && (
                <ActionMenu
                  id={`proposal-${id}-budget-cost-${node.row.id}`}
                  label={`Actions for ${node.row.name}`}
                  icon="menu"
                  className={styles.budgetRowMenu}
                  items={[
                    {
                      key: "edit",
                      label: "Edit",
                      run: () =>
                        router.push(
                          `/proposals/${type}/${id}/budget/staff/${node.row.id}${versionId ? `?version=${versionId}` : ""}`,
                        ),
                    },
                    {
                      key: "delete",
                      label: "Delete",
                      disabled: true,
                      run: () => {},
                    },
                    {
                      key: "clone",
                      label: "Clone",
                      disabled: true,
                      run: () => {},
                    },
                  ]}
                />
              )
          : undefined
      }
    />
  );
}

function nameOf(node: Node) {
  return node.kind === "group"
    ? node.group.name
    : node.kind === "category"
      ? node.category.name
      : node.row.name;
}

/** A row's values by column, as the legacy tree's group, category and line rows fill them. */
function values(node: Node): Values {
  if (node.kind !== "line") {
    const item = node.kind === "group" ? node.group : node.category;
    return {
      "unindexed-cost": item.unindexed,
      "total-cost": item.total,
      yearSplits: item.yearSplits,
    };
  }
  const { row } = node;
  return {
    role: row.role,
    "project-fte": row.fte,
    "project-avg-fte": row.averageFte,
    "project-hours": row.hours,
    "project-months": row.months,
    "unindexed-cost": row.unindexed,
    "total-cost": row.total,
    yearSplits: row.yearSplits,
  };
}
