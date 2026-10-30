import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import type { Resources } from "@/server/platform/configuration/resources";
import type { displayFormat } from "@/server/platform/configuration/formatting";
import type { proposalPricing } from "@/server/modules/proposals/pricing";
import styles from "./proposal-record.module.css";

function percent(value: string | number, decimals: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? `${(parsed * 100).toFixed(decimals || 2)}%`
    : String(value);
}

/** The Funder Rules tab: the proposal's pricing split, each figure RB-gated. */
export function ProposalPricing({
  id,
  pricing,
  rb,
  format,
}: {
  id: string;
  pricing: Awaited<ReturnType<typeof proposalPricing>>;
  rb: Resources;
  format: Awaited<ReturnType<typeof displayFormat>>;
}) {
  const currency = format?.currency ?? "GBP";
  const amount = (value: string | number) =>
    functions.format.moneyDisplay(String(value), currency, format);
  const pct = (value: string | number) => percent(value, format?.decimals ?? 2);
  const fields = [
    [
      "institution_contribution",
      "Institution Contribution (Indexed)",
      amount(pricing.institution),
    ],
    [
      "institution_contribution-percent",
      "Institution Contribution % (Indexed)",
      pct(pricing.institutionPercent),
    ],
    ["funder-contribution", "Funder Contribution", amount(pricing.funder)],
    [
      "funder-contribution-percent",
      "Funder Contribution % (Indexed)",
      pct(pricing.funderPercent),
    ],
    [
      "funder-percent-unindexed",
      "Funder Contribution % (UnIndexed)",
      pct(pricing.unindexedFunderPercent),
    ],
    ["grand-total", "Grand Total (Indexed)", amount(pricing.indexed)],
    [
      "total-application-amount",
      "Total Application amount",
      amount(pricing.funder),
    ],
    [
      "grand-total-unindexed",
      "Grand Total (Unindexed)",
      amount(pricing.unindexed),
    ],
  ];
  return (
    <section id={`proposal-${id}-pricing`} className={styles.pricing}>
      <div className={styles.pricingGrid}>
        {fields.map(([key, fallback, value]) =>
          serverFunctions.resources.resourceVisible(
            rb,
            pricing.bundle,
            "labels",
            key,
          ) ? (
            <div id={`proposal-${id}-pricing-${key}`} key={key}>
              <strong>
                {serverFunctions.resources.label(
                  rb,
                  pricing.bundle,
                  "labels",
                  key,
                  fallback,
                )}
              </strong>
              <span>{value}</span>
            </div>
          ) : null,
        )}
      </div>
      <div
        id={`proposal-${id}-pricing-currency`}
        className={styles.pricingCurrency}
      >
        <strong>Currency</strong>
        <span>{currency}</span>
      </div>
    </section>
  );
}
