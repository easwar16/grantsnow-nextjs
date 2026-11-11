"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { proposals } from "@/lib/api";
import { functions } from "@/lib/functions";
import type { proposalPricing } from "@/server/modules/proposals/pricing";
import type { FormattingConfiguration } from "@/server/platform/configuration/formatting";
import styles from "./proposal-record.module.css";

type Pricing = Awaited<ReturnType<typeof proposalPricing>>;
type Funder = Pricing["globalFunders"][number];
type Draft = {
  id: number;
  contribution: string;
  ruleApplied: "" | "UNINDEXED";
};

export function PricingGlobalDialog({
  id,
  type,
  pricing,
  format,
  currency,
  rate,
  labels,
  onClose,
}: {
  id: string;
  type: string;
  pricing: Pricing;
  format?: FormattingConfiguration;
  currency: string;
  rate: number;
  labels: {
    title: string;
    name: string;
    eligible: string;
    contribution: string;
    percent: string;
    unindexedContribution: string;
    unindexedPercent: string;
    showUnindexedContribution: boolean;
    showUnindexedPercent: boolean;
  };
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(pricing.globalFunders);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setRows(pricing.globalFunders), [pricing.globalFunders]);
  const indexed = Number(pricing.indexed);
  const unindexed = Number(pricing.unindexed);
  const money = (value: string | number) =>
    Number.isFinite(Number(value))
      ? functions.format.moneyDisplay(String(Number(value) * rate), currency, format)
      : String(value);
  const percent = (value: string | number) =>
    Number.isFinite(Number(value))
      ? `${(Number(value) * 100).toFixed(format?.decimals ?? 2)}%`
      : String(value);
  const draftContribution = draft ? Number(draft.contribution) / rate : 0;
  const change = (
    field: "contribution" | "percent" | "unindexedContribution" | "unindexedPercent",
    value: string,
  ) => {
    if (!draft) return;
    const amount = Number(value);
    let contribution = amount;
    if (field === "percent") contribution = (amount / 100) * indexed;
    if (field === "unindexedContribution")
      contribution = unindexed === 0 ? 0 : (amount / rate / unindexed) * indexed;
    if (field === "unindexedPercent") contribution = (amount / 100) * unindexed;
    setDraft({
      ...draft,
      contribution:
        field === "contribution" ? value : String(contribution * rate),
      ruleApplied:
        field === "unindexedContribution" || field === "unindexedPercent"
          ? "UNINDEXED"
          : "",
    });
    setError("");
  };
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
    const result = await proposals.saveGlobalPricingFunder(type, id, {
      funderId: draft.id,
      contribution: contribution / rate,
      ruleApplied: draft.ruleApplied,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setRows(result.data.funders);
    setDraft(null);
    router.refresh();
  };
  const input = (
    row: Funder,
    field: "contribution" | "percent" | "unindexedContribution" | "unindexedPercent",
    value: string,
    label: string,
  ) =>
    draft?.id === row.id ? (
      <input
        aria-label={label}
        className={styles.pricingGlobalInput}
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(event) => change(field, event.target.value)}
        disabled={busy}
      />
    ) : null;
  return (
    <ActionDialog
      id={`proposal-${id}-pricing-global-dialog`}
      title={labels.title}
      width="50vw"
      className={styles.pricingGlobalDialog}
      busy={busy}
      onClose={onClose}
    >
      <div className={styles.pricingDialogTable}>
        <DataTable
          id={`proposal-${id}-pricing-global-funders`}
          label="Global Funder Values"
          height="none"
          columns={[
            {
              id: "name",
              header: labels.name,
              cell: (row: Funder) => row.name,
            },
            {
              id: "eligible",
              header: labels.eligible,
              cell: (row: Funder) => money(row.eligible),
            },
            {
              id: "contribution",
              header: labels.contribution,
              cell: (row: Funder) =>
                input(row, "contribution", draft?.contribution ?? "", labels.contribution) ??
                money(row.contribution),
            },
            {
              id: "percent",
              header: labels.percent,
              cell: (row: Funder) =>
                input(
                  row,
                  "percent",
                  indexed === 0 ? "0" : String((draftContribution / indexed) * 100),
                  labels.percent,
                ) ?? percent(row.percent),
            },
            ...(labels.showUnindexedContribution
              ? [{
                  id: "unindexedContribution",
                  header: labels.unindexedContribution,
                  cell: (row: Funder) =>
                    input(
                      row,
                      "unindexedContribution",
                      indexed === 0
                        ? "0"
                        : String((draftContribution / indexed) * unindexed * rate),
                      labels.unindexedContribution,
                    ) ?? money(row.unindexedContribution),
                }]
              : []),
            ...(labels.showUnindexedPercent
              ? [{
                  id: "unindexedPercent",
                  header: labels.unindexedPercent,
                  cell: (row: Funder) =>
                    input(
                      row,
                      "unindexedPercent",
                      unindexed === 0
                        ? "0"
                        : String((draftContribution / unindexed) * 100),
                      labels.unindexedPercent,
                    ) ?? percent(row.unindexedPercent),
                }]
              : []),
          ]}
          rows={rows}
          rowKey={(row) => String(row.id)}
          empty="No data to display."
          actionCell={(row) =>
            draft?.id === row.id ? (
              <>
                <button
                  type="button"
                  aria-label={`Save ${row.name}`}
                  title="Save"
                  onClick={() => void save()}
                  disabled={busy}
                >
                  <Icon name="check" size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Cancel ${row.name}`}
                  title="Cancel"
                  onClick={() => { setDraft(null); setError(""); }}
                  disabled={busy}
                >
                  <Icon name="close" size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label={`Edit ${row.name}`}
                title="Edit"
                onClick={() => {
                  setDraft({
                    id: row.id,
                    contribution: String(Number(row.contribution) * rate),
                    ruleApplied: "",
                  });
                  setError("");
                }}
                disabled={busy || draft !== null || !Number.isFinite(Number(row.contribution))}
              >
                <Icon name="edit" size={16} />
              </button>
            )
          }
        />
      </div>
      {error && <p role="alert" className={styles.pricingError}>{error}</p>}
    </ActionDialog>
  );
}
