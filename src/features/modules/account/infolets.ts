/**
 * The Preferences drawer's infolet switches, in the legacy order, with the RB `dashboard` (group, key, seed) each
 * one is labelled by (shell-configure-drawer-fragment.html). Legacy shows only these, and only when stored.
 */
export const infoletSwitches = {
  needAttention: [
    [
      "pApproachingDeadlines",
      "labels",
      "proposal-approaching-deadlines",
      "Proposal Approaching deadlines",
    ],
    [
      "pPendingApprovals",
      "labels",
      "proposals-awaiting-approval",
      "Proposals Awaiting Your Approval",
    ],
    [
      "cApproachingDeadlines",
      "labels",
      "contracts-approaching-deadlines",
      "Contract Approaching deadlines",
    ],
    [
      "cPendingApprovals",
      "labels",
      "contract-awaiting-approval",
      "Contract Awaiting Your Approval",
    ],
    [
      "eApproachingDeadlines",
      "labels",
      "ethics-approaching-deadlines",
      "Ethics Approaching Deadlines",
    ],
    [
      "ePendingApprovals",
      "labels",
      "ethics-pending-approvals",
      "Ethics Pending Approvals",
    ],
    [
      "aPendingApprovals",
      "labels",
      "awards-awaiting-approval",
      "Awards Awaiting Your Approval",
    ],
    [
      "aApprovedAwards",
      "labels",
      "approved-awards",
      "Approved awards not yet pushed to Finance(ERP)",
    ],
    [
      "eoiPendingApprovals",
      "labels",
      "eoi-pending-approval",
      "EOI Pending Approval",
    ],
  ],
  insights: [
    [
      "ProposalsValuByCostRecovery",
      "header-labels",
      "proposal-value-by-cost-recovery",
      "Proposal Value By Cost Recovery %",
    ],
    [
      "grantCategoriesChart",
      "labels",
      "highest-performing-grant-categories",
      "Highest Performing Grant Categories (Awarded)",
    ],
    ["pByYearChart", "header-labels", "proposals-by-year", "Proposals by Year"],
    [
      "totalPAValueByYearChart",
      "header-labels",
      "total-proposals-total-award-by-year",
      "Total Proposals and Total Award Value by Year",
    ],
    [
      "opportunityStatusChart",
      "labels",
      "funding-opportunity-status",
      "Funding Opportunity Status",
    ],
    [
      "fundingByGrantChart",
      "labels",
      "funding-by-grant-category",
      "Funding by Grant Category (Awarded)",
    ],
    [
      "highestGapsChart",
      "labels",
      "highest-gaps-vs-awarded",
      "Highest Gaps: Applied vs. Awarded Funding",
    ],
    [
      "fundingEfficiencyIndexChart",
      "labels",
      "funding-efficiency-index",
      "Funding Efficiency Index",
    ],
    ["pByStatusChart", "labels", "proposal-by-status", "Proposal by Status"],
    ["eByStatusChart", "header-labels", "ethics-by-status", "Ethics by Status"],
    // The bundle's own spelling.
    ["eByOrgChart", "labels", "ehics-by-organisation", "Ehics by Organisation"],
    ["eByRiskChart", "labels", "ethics-by-risk", "Ethics by Risk"],
    ["aByStatusChart", "labels", "award-by-status", "Awards by Status"],
    ["pByFacultyChart", "labels", "proposals-by-school", "Proposal by School"],
    [
      "awardedProposalsChart",
      "labels",
      "award-proposals-by-school",
      "Award Proposals by School",
    ],
  ],
} as const satisfies Record<
  "needAttention" | "insights",
  readonly (readonly [string, string, string, string])[]
>;
export type InfoletGroup = keyof typeof infoletSwitches;
/** A group's stored switches the drawer shows (`isVisible === true` is on), in the legacy order. */
export function infoletSettings(
  group: InfoletGroup,
  stored: Record<string, { isVisible?: unknown } | undefined> | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    infoletSwitches[group].flatMap(([key]) =>
      stored && Object.hasOwn(stored, key)
        ? [[key, stored[key]?.isVisible === true]]
        : [],
    ),
  );
}
