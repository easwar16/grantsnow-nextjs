"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Select } from "@/components/ui/select";
import { proposals } from "@/lib/api";
import styles from "./proposal-record.module.css";

export function ProposalPrint({
  type,
  id,
  reports,
  currencies,
  defaultCurrency,
}: {
  type: string;
  id: string;
  reports: { code: string; label: string; enabled: boolean }[];
  currencies: { code: string; label: string; rate: string }[];
  defaultCurrency: string;
}) {
  const [menu, setMenu] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!code || busy) return;
    setBusy(true);
    setError("");
    const result = await proposals.printReport(type, id, code, currency);
    if (result.ok) {
      const url = URL.createObjectURL(result.data.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setCode(null);
    } else setError(result.error.message);
    setBusy(false);
  };
  if (reports.length === 0) return null;
  return (
    <div className={styles.printWrap}>
      <button
        id={`proposal-${id}-print`}
        type="button"
        className={styles.actionButton}
        aria-expanded={menu}
        aria-controls={`proposal-${id}-print-menu`}
        onClick={() => setMenu((current) => !current)}
      >
        ▣ &nbsp; Print &nbsp;⌄
      </button>
      {menu && (
        <div
          id={`proposal-${id}-print-menu`}
          className={styles.printMenu}
          role="menu"
        >
          {reports.map((report) => (
            <button
              id={`proposal-${id}-print-${report.code.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`}
              key={report.code}
              type="button"
              role="menuitem"
              disabled={!report.enabled}
              onClick={() => {
                setMenu(false);
                setCode(report.code);
              }}
            >
              {report.label}
            </button>
          ))}
        </div>
      )}
      {code && (
        <ActionDialog
          id={`proposal-${id}-print-dialog`}
          title="Print Report Details"
          width="28.653vw"
          busy={busy}
          onClose={() => setCode(null)}
        >
          <div className={styles.printFields}>
            <Select
              id={`proposal-${id}-print-currency`}
              label="Currency"
              options={currencies.map((row) => ({
                value: row.code,
                label: row.label,
              }))}
              value={currency}
              onChange={setCurrency}
              clearable={false}
              disabled={busy}
            />
            <div>
              <strong>Currency Rate</strong>
              <div>
                {currencies.find((row) => row.code === currency)?.rate ?? ""}
              </div>
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className={styles.printFoot}>
            <button
              id={`proposal-${id}-print-submit`}
              type="button"
              className="gn-btn gn-btn--primary"
              disabled={busy || !currency}
              onClick={() => void submit()}
            >
              {busy ? "Preparing…" : "Print"}
            </button>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
