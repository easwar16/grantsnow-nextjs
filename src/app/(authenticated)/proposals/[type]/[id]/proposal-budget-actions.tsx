"use client";

import { useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { FxRates } from "@/features/record/fx-rates/fx-rates";
import { proposals } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { CostingEditor } from "./budget/costing-editor";
import styles from "./proposal-record.module.css";

export function ProposalBudgetActions({
  id,
  type,
  versionId,
  fxLabel,
  viabilityLabel,
  quickCostLabel,
}: {
  id: string;
  type: string;
  versionId: number | null;
  fxLabel: string | null;
  viabilityLabel: string | null;
  quickCostLabel: string | null;
}) {
  const segment = useSelectedLayoutSegment();
  const [open, setOpen] = useState(false);
  const [viabilityOpen, setViabilityOpen] = useState(false);
  const [report, setReport] = useState<{
    columns: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [reportError, setReportError] = useState("");
  const [loading, setLoading] = useState(false);
  if (segment !== "budget") return null;
  const openViability = async () => {
    if (loading) return;
    setViabilityOpen(true);
    setLoading(true);
    setReport(null);
    setReportError("");
    const result = await proposals.viability(type, id);
    if (result.ok) setReport(result.data);
    else setReportError(result.error.message);
    setLoading(false);
  };
  return (
    <>
      {quickCostLabel && (
        <CostingEditor
          id={id}
          type={type}
          kind="quick"
          label={quickCostLabel}
          icon
        />
      )}
      {fxLabel && versionId !== null && (
        <button
          id={`proposal-${id}-budget-fx-rates`}
          type="button"
          className={styles.actionButton}
          onClick={() => setOpen(true)}
        >
          <Icon name="fx-rates" /> {fxLabel}
        </button>
      )}
      {viabilityLabel && (
        <button
          id={`proposal-${id}-budget-viability`}
          type="button"
          className={styles.actionButton}
          disabled={loading}
          onClick={() => void openViability()}
        >
          <Icon name="viability-checks" /> {viabilityLabel}
        </button>
      )}
      {open && fxLabel && versionId !== null && (
        <ActionDialog
          id={`proposal-${id}-budget-fx-rates-dialog`}
          title={fxLabel}
          onClose={() => setOpen(false)}
        >
          <FxRates
            id={`proposal-${id}-budget-fx-rates-panel`}
            type={type}
            proposalId={id}
            versionId={String(versionId)}
            mode="PURCHASE"
          />
        </ActionDialog>
      )}
      {viabilityOpen && viabilityLabel && (
        <ActionDialog
          id={`proposal-${id}-budget-viability-dialog`}
          title={viabilityLabel}
          onClose={() => setViabilityOpen(false)}
        >
          {loading ? (
            <p role="status">Loading…</p>
          ) : reportError ? (
            <p role="alert">{reportError}</p>
          ) : report?.rows.length ? (
            <table
              className={styles.budgetTable}
              id={`proposal-${id}-budget-viability-table`}
            >
              <thead>
                <tr>
                  {report.columns.map((column) => (
                    <th scope="col" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={index}>
                    {report.columns.map((column) => (
                      <td key={column}>{row[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No data to display.</p>
          )}
        </ActionDialog>
      )}
    </>
  );
}
