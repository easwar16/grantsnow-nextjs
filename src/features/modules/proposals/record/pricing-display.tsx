"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { proposals } from "@/lib/api";
import { functions } from "@/lib/functions";
import type { proposalPricing } from "@/server/modules/proposals/pricing";
import type { FormattingConfiguration } from "@/server/platform/configuration/formatting";
import { PricingTree } from "./pricing-tree";
import { PricingGlobalDialog } from "./pricing-global-dialog";
import styles from "./proposal-record.module.css";

type Pricing = Awaited<ReturnType<typeof proposalPricing>>;
type PricingResetPreview = {
  totals: Pick<
    Pricing,
    | "institution"
    | "institutionPercent"
    | "funder"
    | "funderPercent"
    | "unindexedFunderPercent"
    | "indexed"
    | "unindexed"
    | "eligible"
  >;
  lines: Pricing["lines"];
};
type Field = {
  key: string;
  label: string;
  value: string | number;
  kind: "money" | "percent";
};

export function PricingDisplay({
  id,
  type,
  pricing,
  format,
  fields,
  currencyLabel,
  currencyVisible,
  ruleVisible,
  dialogFields,
  viewLabels,
  globalVisible,
  globalLabels,
}: {
  id: string;
  type: string;
  pricing: Pricing;
  format?: FormattingConfiguration;
  fields: Field[];
  currencyLabel: string;
  currencyVisible: boolean;
  ruleVisible: boolean;
  dialogFields: Record<string, { visible: boolean; label: string }>;
  viewLabels: { split: string; combined: string; proposalNumber: string };
  globalVisible: boolean;
  globalLabels: {
    title: string;
    action: string;
    name: string;
    eligible: string;
    contribution: string;
    percent: string;
    unindexedContribution: string;
    unindexedPercent: string;
    showUnindexedContribution: boolean;
    showUnindexedPercent: boolean;
  };
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState(pricing.defaultCurrency);
  const [preview, setPreview] = useState<PricingResetPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [globalOpen, setGlobalOpen] = useState(false);
  const reset = async () => {
    setBusy(true);
    setError("");
    const result = await proposals.previewPricingReset(type, id);
    setBusy(false);
    if (result.ok) setPreview(result.data);
    else setError(result.error.message);
  };
  const save = async () => {
    setBusy(true);
    setError("");
    const result = await proposals.savePricingReset(type, id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPreview(null);
    router.refresh();
  };
  const selected = pricing.currencies.find((row) => row.code === currency);
  const rate = selected?.rate ?? 1;
  const display = (field: Field) => {
    const keyToTotal: Record<
      string,
      keyof NonNullable<typeof preview>["totals"]
    > = {
      institution_contribution: "institution",
      "institution_contribution-percent": "institutionPercent",
      "funder-contribution": "funder",
      "funder-contribution-percent": "funderPercent",
      "funder-percent-unindexed": "unindexedFunderPercent",
      "grand-total": "indexed",
      "grand-total-unindexed": "unindexed",
      "grand-total-eligible": "eligible",
      "total-application-amount": "funder",
    };
    const raw =
      preview && keyToTotal[field.key]
        ? preview.totals[keyToTotal[field.key]]
        : field.value;
    const value = Number(raw);
    if (!Number.isFinite(value)) return String(raw);
    return field.kind === "percent"
      ? `${(value * 100).toFixed(format?.decimals ?? 2)}%`
      : functions.format.moneyDisplay(String(value * rate), currency, format);
  };
  return (
    <section id={`proposal-${id}-pricing`} className={styles.pricing}>
      <div className={styles.pricingGrid}>
        {fields.map((field) => (
          <div id={`proposal-${id}-pricing-field-${field.key}`} key={field.key}>
            <strong>{field.label}</strong>
            <span>{display(field)}</span>
          </div>
        ))}
      </div>
      <div className={styles.pricingActions}>
        {preview ? (
          <>
            <button
              type="button"
              id={`proposal-${id}-pricing-save`}
              className="gn-btn gn-btn--primary"
              onClick={() => void save()}
              disabled={busy}
            >
              <Icon name="save" size={16} /> Save
            </button>
            <button
              type="button"
              id={`proposal-${id}-pricing-cancel`}
              className="gn-btn gn-btn--outlined"
              onClick={() => {
                setPreview(null);
                setError("");
              }}
              disabled={busy}
            >
              <Icon name="cancel" size={16} /> Cancel
            </button>
          </>
        ) : (
          <>
            {pricing.canReset && (
              <button
                type="button"
                id={`proposal-${id}-pricing-reset`}
                className="gn-btn gn-btn--outlined"
                onClick={() => void reset()}
                disabled={busy}
              >
                <Icon name="reset" size={16} /> Reset to default
              </button>
            )}
            {globalVisible && pricing.canEditGlobal && (
              <button
                type="button"
                id={`proposal-${id}-pricing-global`}
                className="gn-btn gn-btn--outlined"
                onClick={() => setGlobalOpen(true)}
                disabled={busy}
              >
                <Icon name="edit" size={16} /> {globalLabels.action}
              </button>
            )}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.pricingError}>
          {error}
        </p>
      )}
      {currencyVisible && (
        <div className={styles.pricingCurrency}>
          <strong>{currencyLabel}</strong>
          <Select
            id={`proposal-${id}-pricing-currency`}
            label={currencyLabel}
            value={currency}
            onChange={setCurrency}
            clearable={false}
            options={pricing.currencies.map((row) => ({
              value: row.code,
              label: `${row.label} | ${row.rate}`,
            }))}
          />
        </div>
      )}
      <PricingTree
        id={id}
        type={type}
        lines={preview?.lines ?? pricing.lines}
        hasCollaborators={pricing.hasCollaborators}
        format={format}
        currency={currency}
        rate={rate}
        ruleVisible={ruleVisible}
        dialogFields={dialogFields}
        viewLabels={viewLabels}
      />
      {globalOpen && (
        <PricingGlobalDialog
          id={id}
          type={type}
          pricing={pricing}
          format={format}
          currency={currency}
          rate={rate}
          labels={globalLabels}
          onClose={() => setGlobalOpen(false)}
        />
      )}
    </section>
  );
}
