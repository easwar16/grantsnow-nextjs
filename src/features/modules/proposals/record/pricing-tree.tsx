"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { TabBar } from "@/components/ui/tab-bar";
import { proposals } from "@/lib/api";
import { functions } from "@/lib/functions";
import type { proposalPricing } from "@/server/modules/proposals/pricing";
import type { FormattingConfiguration } from "@/server/platform/configuration/formatting";
import styles from "./proposal-record.module.css";

type Line = Awaited<ReturnType<typeof proposalPricing>>["lines"][number];
type Bucket = { key: string; name: string; lines: Line[] };
type Node =
  | { kind: "section"; bucket: Bucket }
  | { kind: "category"; bucket: Bucket; sectionKey: string }
  | { kind: "line"; line: Line };

const values = (node: Node) =>
  node.kind === "line" ? [node.line] : node.bucket.lines;
const total = (
  rows: Line[],
  key: "eligible" | "indexed" | "unindexed" | "funder" | "institution",
) => {
  const amounts = rows.map((row) => row[key]);
  const masked = amounts.find((value) => !Number.isFinite(Number(value)));
  return masked == null
    ? amounts.reduce<number>((sum, value) => sum + Number(value), 0)
    : String(masked);
};

function fundersForRows(rows: Line[]) {
  const grouped = new Map<
    string,
    {
      id: number | null;
      name: string;
      eligible: (string | number)[];
      contribution: (string | number)[];
    }
  >();
  for (const row of rows) {
    for (const funder of row.funders) {
      const key = funder.id == null ? `name:${funder.name}` : `id:${funder.id}`;
      const entry = grouped.get(key) ?? {
        id: funder.id,
        name: funder.name,
        eligible: [],
        contribution: [],
      };
      entry.eligible.push(funder.eligible);
      entry.contribution.push(funder.contribution);
      grouped.set(key, entry);
    }
  }
  const aggregate = (values: (string | number)[]) => {
    const masked = values.find((value) => !Number.isFinite(Number(value)));
    return masked == null
      ? values.reduce<number>((sum, value) => sum + Number(value), 0)
      : String(masked);
  };
  return [...grouped.values()].map((funder) => ({
    id: funder.id,
    name: funder.name,
    eligible: aggregate(funder.eligible),
    contribution: aggregate(funder.contribution),
  }));
}

export function PricingTree({
  id,
  type,
  lines,
  hasCollaborators,
  format,
  currency,
  rate,
  ruleVisible,
  dialogFields,
  viewLabels,
}: {
  id: string;
  type: string;
  lines: Line[];
  hasCollaborators: boolean;
  format?: FormattingConfiguration;
  currency: string;
  rate: number;
  ruleVisible: boolean;
  dialogFields: Record<string, { visible: boolean; label: string }>;
  viewLabels: { split: string; combined: string; proposalNumber: string };
}) {
  const router = useRouter();
  const [view, setView] = useState<"split" | "combined">("split");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [draft, setDraft] = useState<{
    line: Line;
    rows: Line[];
    scope:
      | "line"
      | "category"
      | "section"
      | "combined-category"
      | "combined-section";
    funderId: number;
    contribution: string;
    ruleApplied: "INDEXED" | "UNINDEXED";
    editing: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!draft || busy) return;
    const contribution = Number(draft.contribution);
    if (
      draft.contribution.trim() === "" ||
      !Number.isFinite(contribution) ||
      contribution < 0
    ) {
      setError("Enter a valid Funder Contribution.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await proposals.savePricingFunder(type, id, {
      lineId: draft.line.id,
      ...(draft.scope === "line" ? {} : { scope: draft.scope }),
      funderId: draft.funderId,
      contribution: contribution / rate,
      ruleApplied: draft.ruleApplied,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDraft(null);
    router.refresh();
  };
  const openEditor = (node: Node) => {
    const rows = values(node);
    const line = rows[0];
    const funder = line?.funders.find(
      (item) =>
        item.id != null &&
        rows.every((row) => row.funders.some((other) => other.id === item.id)),
    );
    if (!line || !funder || rows.some((row) => !row.canEdit)) return;
    setDraft({
      line,
      rows,
      scope:
        node.kind === "line"
          ? "line"
          : view === "combined"
            ? `combined-${node.kind}`
            : node.kind,
      funderId: funder.id!,
      contribution: String(
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.funders.find((item) => item.id === funder.id)!.contribution,
            ),
          0,
        ) * rate,
      ),
      ruleApplied: "INDEXED",
      editing: false,
    });
    setError("");
  };
  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; title: string; lines: Line[] }
    >();
    for (const line of lines) {
      const key = `${line.proposalId}:${line.collaboratorId ?? "primary"}`;
      const group = grouped.get(key) ?? {
        key,
        title: `${line.proposalNumber || `Proposal ${line.proposalId}`} : ${line.collaboratorName || "Primary"}`,
        lines: [],
      };
      group.lines.push(line);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [lines]);
  if (groups.length === 0) return null;
  const shown =
    view === "combined"
      ? [{ key: "combined", title: "Combined View", lines }]
      : groups;
  const money = (value: string | number) =>
    Number.isFinite(Number(value))
      ? functions.format.moneyDisplay(
          String(Number(value) * rate),
          currency,
          format,
        )
      : String(value);
  const dialogAmount = (value: string | number) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("en-GB", {
          minimumFractionDigits: format?.decimals ?? 2,
          maximumFractionDigits: format?.decimals ?? 2,
        }).format(number * rate)
      : String(value);
  };
  const percent = (rows: Line[]) => {
    const eligible = total(rows, "eligible");
    const indexed = total(rows, "indexed");
    const e = Number(eligible);
    const i = Number(indexed);
    return Number.isFinite(e) && Number.isFinite(i)
      ? `${(i === 0 ? 0 : (e / i) * 100).toFixed(format?.decimals ?? 2)}%`
      : String(eligible);
  };
  const institutionPercent = (rows: Line[]) => {
    const institution = total(rows, "institution");
    const indexed = total(rows, "indexed");
    const n = Number(institution);
    const d = Number(indexed);
    return Number.isFinite(n) && Number.isFinite(d)
      ? `${(d === 0 ? 0 : (n / d) * 100).toFixed(format?.decimals ?? 2)}%`
      : String(institution);
  };
  const funderNames = [
    ...new Set(
      lines.flatMap((line) =>
        line.funders.length
          ? line.funders.map((funder) => funder.name)
          : line.funderName
            ? [line.funderName]
            : [],
      ),
    ),
  ];
  const funderTotal = (
    rows: Line[],
    name: string,
    key: "eligible" | "contribution",
  ) => {
    const amounts = rows.map((line) => {
      const funder = line.funders.find((item) => item.name === name);
      return funder
        ? funder[key]
        : line.funders.length === 0 && line.funderName === name
          ? key === "eligible"
            ? line.eligible
            : line.funder
          : 0;
    });
    const masked = amounts.find((value) => !Number.isFinite(Number(value)));
    return masked == null
      ? amounts.reduce<number>((sum, value) => sum + Number(value), 0)
      : String(masked);
  };
  const columnsFor = (groupLines: Line[]): TableColumn<Node>[] => [
    {
      id: "name",
      header: "Name",
      cell: (node) =>
        node.kind === "line" ? node.line.name : node.bucket.name,
    },
    ...(view === "combined"
      ? [
          {
            id: "proposal-number",
            header: viewLabels.proposalNumber,
            cell: (node: Node) =>
              node.kind === "line" ? node.line.proposalNumber : "",
          },
        ]
      : []),
    {
      id: "role",
      header: "Project Role",
      cell: (node) => (node.kind === "line" ? node.line.item : ""),
    },
    {
      id: "eligible",
      header: "Cost to funder",
      cell: (node) => money(total(values(node), "eligible")),
      footer: money(total(groupLines, "eligible")),
    },
    {
      id: "indexed",
      header: "Indexed Cost",
      cell: (node) => money(total(values(node), "indexed")),
      footer: money(total(groupLines, "indexed")),
    },
    {
      id: "unindexed",
      header: "UNINDEXED COST",
      cell: (node) => money(total(values(node), "unindexed")),
      footer: money(total(groupLines, "unindexed")),
    },
    {
      id: "eligible-cost",
      header: "Eligible Cost",
      cell: (node) => money(total(values(node), "eligible")),
      footer: money(total(groupLines, "eligible")),
    },
    {
      id: "eligible-percent",
      header: "Eligible Percent",
      cell: (node) => percent(values(node)),
      footer: percent(groupLines),
    },
    {
      id: "funder",
      header: "Funder Contribution",
      cell: (node) => money(total(values(node), "funder")),
      footer: money(total(groupLines, "funder")),
    },
    {
      id: "institution",
      header: "Institution Contribution",
      cell: (node) => money(total(values(node), "institution")),
      footer: money(total(groupLines, "institution")),
    },
    ...funderNames.flatMap((name, index): TableColumn<Node>[] => [
      {
        id: `funder-${index}-eligible`,
        header: `${name} - Eligible Cost`,
        cell: (node) => money(funderTotal(values(node), name, "eligible")),
        footer: money(funderTotal(groupLines, name, "eligible")),
      },
      {
        id: `funder-${index}-contribution`,
        header: name,
        cell: (node) => money(funderTotal(values(node), name, "contribution")),
        footer: money(funderTotal(groupLines, name, "contribution")),
      },
    ]),
  ];
  return (
    <div
      id={`proposal-${id}-pricing-details`}
      className={styles.pricingDetails}
    >
      {groups.length > 1 && (
        <div id={`proposal-${id}-pricing-view`} className={styles.pricingViews}>
          <TabBar
            id={`proposal-${id}-pricing-view-tabs`}
            label="Pricing view"
            tabs={[
              { key: "split", name: viewLabels.split },
              { key: "combined", name: viewLabels.combined },
            ]}
            selected={view}
            onSelect={setView}
            align="start"
          />
        </div>
      )}
      <div
        id={`proposal-${id}-pricing-view-tabs-panel-${view}`}
        role={groups.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={
          groups.length > 1
            ? `proposal-${id}-pricing-view-tabs-tab-${view}`
            : undefined
        }
      >
        {shown.map((group) => {
          const sections = new Map<string, Bucket>();
          for (const line of group.lines) {
            const section = sections.get(line.sectionCode) ?? {
              key: line.sectionCode,
              name: line.section,
              lines: [],
            };
            section.lines.push(line);
            sections.set(line.sectionCode, section);
          }
          return (
            <section
              id={`proposal-${id}-pricing-group-${group.key.replaceAll(":", "-")}`}
              key={group.key}
              style={
                {
                  "--pricing-columns": columnsFor(group.lines).length,
                } as CSSProperties
              }
            >
              <h2 className={styles.pricingGroupHeading}>
                <button
                  type="button"
                  aria-expanded={!closedGroups.includes(group.key)}
                  aria-controls={`proposal-${id}-pricing-table-${group.key.replaceAll(":", "-")}`}
                  onClick={() =>
                    setClosedGroups((current) =>
                      current.includes(group.key)
                        ? current.filter((key) => key !== group.key)
                        : [...current, group.key],
                    )
                  }
                >
                  <span aria-hidden="true">
                    {closedGroups.includes(group.key) ? "▸" : "⌄"}
                  </span>
                  {group.title}
                </button>
              </h2>
              {!closedGroups.includes(group.key) && (
                <DataTable
                  id={`proposal-${id}-pricing-table-${group.key.replaceAll(":", "-")}`}
                  rowIds={`proposal-${id}-pricing-row`}
                  className={styles.pricingTable}
                  height="none"
                  columns={columnsFor(group.lines)}
                  rows={[...sections.values()].map((bucket): Node => ({
                    kind: "section",
                    bucket,
                  }))}
                  rowKey={(node) =>
                    node.kind === "line"
                      ? `line-${node.line.id}`
                      : `${node.kind}-${node.bucket.key}-${"sectionKey" in node ? node.sectionKey : ""}`
                  }
                  childrenOf={(node) => {
                    if (node.kind === "line") return undefined;
                    if (node.kind === "category")
                      return node.bucket.lines.map((line): Node => ({
                        kind: "line",
                        line,
                      }));
                    const categories = new Map<string, Bucket>();
                    for (const line of node.bucket.lines) {
                      const category = categories.get(line.categoryCode) ?? {
                        key: line.categoryCode,
                        name: line.category,
                        lines: [],
                      };
                      category.lines.push(line);
                      categories.set(line.categoryCode, category);
                    }
                    return [...categories.values()].map((bucket): Node => ({
                      kind: "category",
                      bucket,
                      sectionKey: node.bucket.key,
                    }));
                  }}
                  rowLabel={(node) =>
                    node.kind === "line" ? node.line.name : node.bucket.name
                  }
                  rowClassName={(node) =>
                    node.kind === "section"
                      ? styles.budgetGroupRow
                      : node.kind === "category"
                        ? styles.budgetCategoryRow
                        : styles.budgetLineRow
                  }
                  actionCell={(node) => {
                    const rows = values(node);
                    const line = rows[0];
                    const commonFunder = line?.funders.some(
                      (funder) =>
                        funder.id != null &&
                        rows.every((row) =>
                          row.funders.some((other) => other.id === funder.id),
                        ),
                    );
                    const enabled =
                      (view === "split" || !hasCollaborators) &&
                      rows.length > 0 &&
                      rows.every((row) => row.canEdit) &&
                      commonFunder;
                    const name =
                      node.kind === "line" ? node.line.name : node.bucket.name;
                    return (
                      <button
                        id={
                          node.kind === "line"
                            ? `proposal-${id}-pricing-edit-${node.line.id}`
                            : `proposal-${id}-pricing-edit-${node.kind}-${node.bucket.key}-${"sectionKey" in node ? node.sectionKey : ""}`
                        }
                        type="button"
                        className="gn-btn gn-btn--borderless gn-btn--icon"
                        aria-label={`Edit ${name}`}
                        title="Edit"
                        disabled={!enabled}
                        onClick={() => openEditor(node)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    );
                  }}
                />
              )}
            </section>
          );
        })}
      </div>
      {draft && (
        <ActionDialog
          id={`proposal-${id}-pricing-edit-dialog`}
          title="Edit Pricing Line"
          width="66.667vw"
          className={styles.pricingLineDialog}
          busy={busy}
          onClose={() => setDraft(null)}
        >
          <div className={styles.pricingDialogFields}>
            {(
              [
                [
                  "title",
                  draft.scope === "line"
                    ? draft.line.name
                    : draft.scope.endsWith("category")
                      ? draft.line.category
                      : draft.line.section,
                ],
                ["indexed", dialogAmount(total(draft.rows, "indexed"))],
                ["unindexed", dialogAmount(total(draft.rows, "unindexed"))],
                [
                  "eligible",
                  draft.scope === "category"
                    ? ""
                    : dialogAmount(total(draft.rows, "eligible")),
                ],
                ...(draft.scope === "line" &&
                ruleVisible &&
                draft.line.indexedPricing
                  ? [
                      [
                        "rule",
                        draft.line.indexedPricing === "Y"
                          ? "Indexed cost"
                          : "Unindexed cost",
                      ],
                    ]
                  : []),
                ["institutionPercent", institutionPercent(draft.rows)],
                ["institution", dialogAmount(total(draft.rows, "institution"))],
                ["funder", dialogAmount(total(draft.rows, "funder"))],
                [
                  "funderPercent",
                  Number(total(draft.rows, "indexed")) === 0
                    ? "0.00%"
                    : `${((Number(total(draft.rows, "funder")) / Number(total(draft.rows, "indexed"))) * 100).toFixed(format?.decimals ?? 2)}%`,
                ],
                ["funderUnindexed", dialogAmount(total(draft.rows, "funder"))],
                [
                  "funderPercentUnindexed",
                  Number(total(draft.rows, "unindexed")) === 0
                    ? "0.00%"
                    : `${((Number(total(draft.rows, "funder")) / Number(total(draft.rows, "unindexed"))) * 100).toFixed(format?.decimals ?? 2)}%`,
                ],
              ] as [string, string][]
            )
              .filter(([key]) => dialogFields[key]?.visible)
              .map(([key, value], index) => (
                <label
                  key={key}
                  htmlFor={`proposal-${id}-pricing-edit-field-${index}`}
                >
                  <span>{dialogFields[key].label}</span>
                  <input
                    id={`proposal-${id}-pricing-edit-field-${index}`}
                    value={value}
                    readOnly
                  />
                </label>
              ))}
          </div>
          <div className={styles.pricingDialogTable}>
            <DataTable
              id={`proposal-${id}-pricing-funder-details`}
              label="Funder pricing details"
              height="none"
              columns={[
                {
                  id: "funder",
                  header: "Funder Name",
                  cell: (row: Line["funders"][number]) => row.name,
                },
                {
                  id: "eligible",
                  header: "Eligible Cost",
                  cell: (row: Line["funders"][number]) => money(row.eligible),
                },
                {
                  id: "eligible-percent",
                  header: "Eligible Percent",
                  cell: () => percent(draft.rows),
                },
                {
                  id: "contribution",
                  header: "Funder Contribution",
                  cell: (row: Line["funders"][number]) =>
                    draft.editing && row.id === draft.funderId ? (
                      <input
                        id={`proposal-${id}-pricing-edit-contribution`}
                        aria-label="Funder Contribution"
                        type="number"
                        min="0"
                        step="any"
                        value={draft.contribution}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            contribution: event.target.value,
                            ruleApplied: "INDEXED",
                          })
                        }
                        disabled={busy}
                      />
                    ) : (
                      money(row.contribution)
                    ),
                },
                {
                  id: "indexed-percent",
                  header: "Funder Percentage Indexed",
                  cell: (row: Line["funders"][number]) => {
                    const cost = Number(total(draft.rows, "indexed"));
                    const contribution =
                      draft.editing && row.id === draft.funderId
                        ? Number(draft.contribution) / rate
                        : Number(row.contribution);
                    const pct = cost
                      ? ((contribution / cost) * 100).toFixed(
                          format?.decimals ?? 2,
                        )
                      : "0.00";
                    return draft.editing && row.id === draft.funderId ? (
                      <input
                        aria-label="Funder Percentage Indexed"
                        type="number"
                        min="0"
                        step="any"
                        value={pct}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            contribution: String(
                              (Number(event.target.value) / 100) * cost * rate,
                            ),
                            ruleApplied: "INDEXED",
                          })
                        }
                        disabled={busy}
                      />
                    ) : (
                      `${pct}%`
                    );
                  },
                },
                {
                  id: "unindexed-percent",
                  header: "Funder Percentage Un-Indexed",
                  cell: (row: Line["funders"][number]) => {
                    const cost = Number(total(draft.rows, "unindexed"));
                    const contribution =
                      draft.editing && row.id === draft.funderId
                        ? Number(draft.contribution) / rate
                        : Number(row.contribution);
                    const pct = cost
                      ? ((contribution / cost) * 100).toFixed(
                          format?.decimals ?? 2,
                        )
                      : "0.00";
                    return draft.editing && row.id === draft.funderId ? (
                      <input
                        aria-label="Funder Percentage Un-Indexed"
                        type="number"
                        min="0"
                        step="any"
                        value={pct}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            contribution: String(
                              (Number(event.target.value) / 100) * cost * rate,
                            ),
                            ruleApplied: "UNINDEXED",
                          })
                        }
                        disabled={busy}
                      />
                    ) : (
                      `${pct}%`
                    );
                  },
                },
              ]}
              rows={fundersForRows(draft.rows)}
              rowKey={(row) => String(row.id ?? row.name)}
              empty="No data to display."
              actionCell={(row) =>
                row.id == null ? null : draft.editing &&
                  row.id === draft.funderId ? (
                  <>
                    <button
                      id={`proposal-${id}-pricing-edit-save`}
                      type="button"
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      aria-label={`Save ${row.name}`}
                      title="Save"
                      onClick={() => void save()}
                      disabled={busy}
                    >
                      <Icon name="check" size={16} />
                    </button>
                    <button
                      type="button"
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      aria-label={`Cancel ${row.name}`}
                      title="Cancel"
                      onClick={() => setDraft({ ...draft, editing: false })}
                      disabled={busy}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="gn-btn gn-btn--borderless gn-btn--icon"
                    aria-label={`Edit ${row.name}`}
                    title="Edit"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        funderId: row.id!,
                        contribution: String(Number(row.contribution) * rate),
                        editing: true,
                      })
                    }
                    disabled={busy}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                )
              }
            />
          </div>
          {error && <p role="alert">{error}</p>}
        </ActionDialog>
      )}
    </div>
  );
}
