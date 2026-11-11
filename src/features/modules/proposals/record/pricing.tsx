import { serverFunctions } from "@/server/functions";
import type { Resources } from "@/server/platform/configuration/resources";
import type { displayFormat } from "@/server/platform/configuration/formatting";
import type { proposalPricing } from "@/server/modules/proposals/pricing";
import { PricingDisplay } from "./pricing-display";

/** The Funder Rules tab: the proposal's pricing split, each figure RB-gated. */
export function ProposalPricing({
  id,
  type,
  pricing,
  rb,
  format,
}: {
  id: string;
  type: string;
  pricing: Awaited<ReturnType<typeof proposalPricing>>;
  rb: Resources;
  format: Awaited<ReturnType<typeof displayFormat>>;
}) {
  const dialogResource = (
    visibilityKey: string,
    labelKey: string,
    fallback: string,
  ) => ({
    visible: serverFunctions.resources.resourceVisible(
      rb,
      pricing.bundle,
      "labels",
      visibilityKey,
    ),
    label: serverFunctions.resources.label(
      rb,
      pricing.bundle,
      "labels",
      labelKey,
      fallback,
    ),
  });
  const dialogFields = {
    title: {
      visible: true,
      label: serverFunctions.resources.label(
        rb,
        pricing.bundle,
        "labels",
        "title",
        "Title",
      ),
    },
    indexed: dialogResource("indexed-cost", "indexed-cost", "Indexed cost"),
    unindexed: dialogResource(
      "unindexed-cost",
      "unindexed-cost",
      "Unindexed Cost",
    ),
    eligible: dialogResource("grand-total", "eligible-cost", "Eligible Cost"),
    rule: dialogResource(
      "pricing-rule-applied-on",
      "pricing-rule-applied-on",
      "Rule Applied On",
    ),
    institutionPercent: dialogResource(
      "institution-percentage-indexed",
      "institution-percentage-indexed",
      "Institution Percentage (Indexed)",
    ),
    institution: dialogResource(
      "institution_contribution",
      "institution_contribution",
      "Institution Contribution (Indexed)",
    ),
    funder: dialogResource(
      "sponsor_contribution",
      "sponsor_contribution",
      "Funder Contribution",
    ),
    funderPercent: dialogResource(
      "funders-percentage-indexed",
      "funders-percentage-indexed",
      "Funder Percentage (Indexed)",
    ),
    funderUnindexed: dialogResource(
      "funders-contribution-unindexed",
      "funder-contribution-unindexed",
      "Funder Contribution (Un-Indexed)",
    ),
    funderPercentUnindexed: dialogResource(
      "funders-percentage-unindexed",
      "funders-percentage-unindexed",
      "Funder Percentage (Unindexed)",
    ),
  };
  const fields = [
    [
      "institution_contribution",
      "Institution Contribution (Indexed)",
      pricing.institution,
    ],
    ["funder-contribution", "Funder Contribution", pricing.funder],
    [
      "funder-percent-unindexed",
      "Funder Contribution % (UnIndexed)",
      pricing.unindexedFunderPercent,
    ],
    ["total-application-amount", "Total Application amount", pricing.funder],
    ["grand-total-eligible", "Grand Total (Eligible)", pricing.eligible],
    [
      "institution_contribution-percent",
      "Institution Contribution % (Indexed)",
      pricing.institutionPercent,
    ],
    [
      "funder-contribution-percent",
      "Funder Contribution % (Indexed)",
      pricing.funderPercent,
    ],
    ["grand-total", "Grand Total (Indexed)", pricing.indexed],
    ["grand-total-unindexed", "Grand Total (Unindexed)", pricing.unindexed],
  ];
  return (
    <PricingDisplay
      id={id}
      type={type}
      pricing={pricing}
      format={format}
      fields={fields.flatMap(([key, fallback, value]) =>
        serverFunctions.resources.resourceVisible(
          rb,
          pricing.bundle,
          "labels",
          String(key) === "grand-total-eligible" ? "grand-total" : String(key),
        )
          ? [
              {
                key: String(key),
                label: serverFunctions.resources.label(
                  rb,
                  pricing.bundle,
                  "labels",
                  String(key),
                  String(fallback),
                ),
                value,
                kind: String(key).includes("percent")
                  ? ("percent" as const)
                  : ("money" as const),
              },
            ]
          : [],
      )}
      currencyLabel={serverFunctions.resources.label(
        rb,
        pricing.bundle,
        "labels",
        "pricing-currency",
        "Currency",
      )}
      currencyVisible={serverFunctions.resources.resourceVisible(
        rb,
        pricing.bundle,
        "labels",
        "pricing-currency",
      )}
      ruleVisible={serverFunctions.resources.resourceVisible(
        rb,
        pricing.bundle,
        "labels",
        "pricing-rule-applied-on",
      )}
      dialogFields={dialogFields}
      viewLabels={{
        split: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "labels",
          "view-type-split",
          "Proposal / Sub-Proposal",
        ),
        combined: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "labels",
          "view-type-combined",
          "Combined View",
        ),
        proposalNumber: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "proposal-number",
          "Proposal Number",
        ),
      }}
      globalVisible={serverFunctions.resources.resourceVisible(
        rb,
        pricing.bundle,
        "button-labels",
        "edit-global-values",
      )}
      globalLabels={{
        title: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "dialog-titles",
          "funder-contribution",
          "Funder Contribution",
        ),
        action: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "button-labels",
          "edit-global-values",
          "Edit Global Funder Values",
        ),
        name: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "funder-name",
          "Funder Name",
        ),
        eligible: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "eligible-cost",
          "Eligible Cost",
        ),
        contribution: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "funder-contribution",
          "Funder Contribution",
        ),
        percent: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "funder-percentage",
          "Funder Percentage",
        ),
        unindexedContribution: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "unindexed-contribution",
          "Unindexed Contribution",
        ),
        unindexedPercent: serverFunctions.resources.label(
          rb,
          pricing.bundle,
          "table-headers",
          "unindexed-percentage",
          "Unindexed Percentage",
        ),
        showUnindexedContribution: serverFunctions.resources.resourceVisible(
          rb,
          pricing.bundle,
          "table-headers",
          "unindexed-contribution",
        ),
        showUnindexedPercent: serverFunctions.resources.resourceVisible(
          rb,
          pricing.bundle,
          "table-headers",
          "unindexed-percentage",
        ),
      }}
    />
  );
}
