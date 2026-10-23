import "server-only";
import type { Operation } from "@/server/oracle/connection";
import type { InsightDrill } from "./insight-mapping";
import type { ChartLayout } from "@/features/modules/home/types";
export interface WidgetDefinition {
  id: string;
  title: string;
  /** Dashboard RB `<group>.<name>` of the title (`title` is the fallback); its description is the More Info text. */
  labelKey: string;
  module: string;
  section: "needAttention" | "insights";
  operation: Operation;
  orgHeader: "p_org_id" | "org_id";
  chartType?: string;
  renderType?:
    "bar" | "pie" | "line" | "scatter" | "funnel" | "gauge" | "combo";
  mapping?: string;
  columns?: number;
  currency?: boolean;
  tokenHeader?: "p_token";
  kind: "proposal" | "contract" | "ethics" | "award" | "eoi" | "statistics";
  /** Queue column shown as the row date (legacy list binding). */
  date?: string;
  /** Queue column tested for overdue; see docs/home-coverage.md for the per-queue choice. */
  dueBy?: string;
  /** Legacy contract-deadline note: "Overdue by N Days" replaces deadline_days once past. */
  overdueNote?: boolean;
  /** Listing a chart point opens (legacy pieChartDrillChain / statusPieChartSelectionChangeChain). */
  drill?: InsightDrill;
  /** Axis titles, stacking and legend of the legacy oj-chart. */
  layout?: ChartLayout;
}
export const widgets: WidgetDefinition[] = [
  {
    id: "pApproachingDeadlines",
    labelKey: "header-labels.proposals-approaching-deadlines",
    date: "deadline_date",
    dueBy: "deadline_date",
    title: "Proposals Approaching Deadlines",
    module: "PROPOSALS",
    section: "needAttention",
    operation: "getProposalProp_appr_deadline",
    orgHeader: "p_org_id",
    kind: "proposal",
  },
  {
    id: "pPendingApprovals",
    labelKey: "header-labels.proposals-awaiting-approval",
    date: "proposal_creation_date",
    // Owner's GN-Angular build and the live app: an approval is due from its creation date.
    dueBy: "proposal_creation_date",
    title: "Proposals Awaiting Your Approval",
    module: "PROPOSALS",
    section: "needAttention",
    operation: "getProposalPendingApproval",
    orgHeader: "p_org_id",
    kind: "proposal",
  },
  {
    id: "cApproachingDeadlines",
    labelKey: "header-labels.contracts-approaching-deadlines",
    date: "deadline_date",
    dueBy: "deadline_date",
    overdueNote: true,
    title: "Contract deadlines",
    module: "CONTRACTS",
    section: "needAttention",
    operation: "getContractsContract_appr_deadline",
    orgHeader: "p_org_id",
    kind: "contract",
  },
  {
    id: "cPendingApprovals",
    labelKey: "header-labels.contract-awaiting-approval",
    date: "contract_start_date",
    dueBy: "contract_start_date",
    title: "Contracts awaiting approval",
    module: "CONTRACTS",
    section: "needAttention",
    operation: "getContractsContractPendingApproval",
    orgHeader: "p_org_id",
    kind: "contract",
  },
  {
    id: "eApproachingDeadlines",
    labelKey: "header-labels.ethics-approaching-deadline",
    date: "deadline_date",
    dueBy: "deadline_date",
    title: "Ethics deadlines",
    module: "ETHICS",
    section: "needAttention",
    operation: "getDynamicFormsApplApprDeadline2",
    orgHeader: "p_org_id",
    kind: "ethics",
  },
  {
    id: "ePendingApprovals",
    labelKey: "header-labels.ethics-pending-approval",
    date: "appr_deadline_date",
    dueBy: "appr_deadline_date",
    title: "Ethics awaiting approval",
    module: "ETHICS",
    section: "needAttention",
    operation: "getDynamicFormsApplPendingApproval",
    orgHeader: "p_org_id",
    kind: "ethics",
  },
  {
    id: "aPendingApprovals",
    labelKey: "header-labels.awards-awaiting-approval",
    date: "award_creation_date",
    dueBy: "appr_deadline_date",
    title: "Awards awaiting approval",
    module: "AWARDS",
    section: "needAttention",
    operation: "getPost_awardsAwardPendingApproval",
    orgHeader: "org_id",
    kind: "award",
  },
  {
    id: "aApprovedAwards",
    labelKey: "header-labels.approved-awards",
    date: "last_approval_date",
    dueBy: "appr_deadline_date",
    title: "Approved awards",
    module: "AWARDS",
    section: "needAttention",
    operation: "getPost_awardsApprovedAwards",
    orgHeader: "org_id",
    kind: "award",
  },
  {
    id: "eoiPendingApprovals",
    labelKey: "header-labels.eoi-awaiting-approval",
    date: "eoi_creation_date",
    // Owner's GN-Angular build and the live app: an approval is due from its creation date.
    dueBy: "eoi_creation_date",
    title: "EOI awaiting approval",
    module: "opportunities-eoi-list",
    section: "needAttention",
    operation: "getEoiPendingApproval",
    orgHeader: "p_org_id",
    kind: "eoi",
  },
  // Titles are the legacy RB seed values (dashboard header-labels / labels) each tile binds.
  ...([
    {
      id: "ProposalsValuByCostRecovery",
      labelKey: "header-labels.proposal-value-by-cost-recovery",
      title: "Proposal Value By Cost Recovery %",
      module: "PROPOSALS",
      operation: "getProposalGetProposalStatistics",
      chartType: "SCATTER_CHART",
      renderType: "scatter",
      mapping: "scatter",
      columns: 12,
      currency: true,
    },
    {
      id: "grantCategoriesChart",
      labelKey: "header-labels.highest-performing-grant-categories",
      title: "Highest Performing Grant Categories (Awarded)",
      module: "opportunities-finder",
      operation: "getSharedGetTopOppCategoryStat",
      renderType: "combo",
      mapping: "top-category",
      currency: true,
      layout: {
        legend: false,
        yTitle: "No. of application awarded",
        y2Title: "Total awarded amount",
      },
    },
    {
      id: "pByYearChart",
      labelKey: "header-labels.proposals-by-year",
      title: "Proposals by Year",
      module: "PROPOSALS",
      operation: "getProposalGetProposalStatistics",
      chartType: "YEAR_STATUS",
      renderType: "bar",
      mapping: "year-status",
      drill: "proposalYear",
    },
    {
      id: "totalPAValueByYearChart",
      labelKey: "header-labels.total-proposals-total-award-by-year",
      title: "Total Proposals and Total Award Value by Year",
      module: "PROPOSALS",
      operation: "getPost_awardsAwardVsCostStatistics",
      renderType: "line",
      currency: true,
    },
    {
      id: "opportunityStatusChart",
      labelKey: "header-labels.funding-opportunity-status",
      title: "Funding Opportunity Status",
      module: "opportunities-finder",
      operation: "getSharedGetOppFunnelStat",
      renderType: "funnel",
      mapping: "funnel",
      currency: true,
    },
    {
      id: "fundingByGrantChart",
      labelKey: "header-labels.funding-by-grant-category",
      title: "Funding by Grant Category (Awarded)",
      module: "opportunities-finder",
      operation: "getSharedGetOppCategoryStat",
      renderType: "bar",
      mapping: "category",
      currency: true,
      layout: { xTitle: "Grant Category", yTitle: "Awarded Amount" },
    },
    {
      id: "highestGapsChart",
      labelKey: "header-labels.highest-gaps",
      title: "Highest Gaps: Applied vs. Awarded Funding",
      module: "opportunities-finder",
      operation: "getSharedGetOppCategoryStat",
      renderType: "bar",
      mapping: "gap",
      currency: true,
      layout: {
        xTitle: "Grant Category",
        yTitle: "Awarded Amount",
        stack: true,
      },
    },
    {
      id: "fundingEfficiencyIndexChart",
      labelKey: "header-labels.funding-efficiency-index",
      title: "Funding Efficiency Index",
      module: "PROPOSALS",
      operation: "getSharedGetWidgetParameters",
      renderType: "gauge",
      tokenHeader: "p_token",
      currency: true,
    },
    {
      id: "pByStatusChart",
      labelKey: "header-labels.proposals-by-status",
      title: "Proposals by Status",
      module: "PROPOSALS",
      operation: "getProposalGetProposalStatistics",
      chartType: "PROP_STATUS",
      renderType: "pie",
      mapping: "slice",
      drill: "proposalStatus",
    },
    {
      id: "eByStatusChart",
      labelKey: "header-labels.ethics-by-status",
      title: "Ethics by Status",
      module: "ETHICS",
      operation: "getDynamicFormsApplicationStatistics",
      chartType: "ETHICS_STATUS",
      renderType: "pie",
      mapping: "slice",
      drill: "ethicsStatus",
    },
    {
      id: "eByOrgChart",
      labelKey: "header-labels.ethics-by-org",
      title: "Ethics by Org",
      module: "ETHICS",
      operation: "getDynamicFormsApplicationStatistics",
      chartType: "ETHICS_ORG",
      renderType: "pie",
      mapping: "slice",
      drill: "ethicsOrg",
    },
    {
      id: "eByRiskChart",
      labelKey: "header-labels.ethics-by-risk",
      title: "Ethics by Risk",
      module: "ETHICS",
      operation: "getDynamicFormsApplicationStatistics",
      chartType: "ETHICS_RISK",
      renderType: "bar",
      mapping: "risk",
      drill: "ethicsRisk",
    },
    {
      id: "pByFacultyChart",
      labelKey: "header-labels.proposals-by-faculty",
      title: "Proposals by School",
      module: "PROPOSALS",
      operation: "getProposalGetProposalStatistics",
      chartType: "PROP_FACULTY",
      renderType: "pie",
      mapping: "slice",
      drill: "proposalSchool",
    },
    {
      id: "awardedProposalsChart",
      labelKey: "header-labels.awarded-proposals-by-faculty",
      title: "Awarded Proposals by School",
      module: "AWARDS",
      operation: "getPost_awardsAwardStatistics",
      chartType: "AWARD_FACULTY",
      renderType: "pie",
      mapping: "slice",
      drill: "awardedBySchool",
    },
    {
      id: "aByStatusChart",
      labelKey: "header-labels.award-by-status",
      title: "Award by Status",
      module: "AWARDS",
      operation: "getPost_awardsAwardStatistics",
      chartType: "AWARD_STATUS",
      renderType: "pie",
      mapping: "slice",
      drill: "awardStatus",
    },
  ].map((w) => ({
    ...w,
    columns: (w as { columns?: number }).columns || 6,
    section: "insights" as const,
    orgHeader: "p_org_id" as const,
    kind: "statistics" as const,
  })) as WidgetDefinition[]),
];
