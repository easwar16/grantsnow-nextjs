import "server-only";
import type { Operation } from "@/server/api/transport";
import type { InsightDrill } from "./insight-mapping";
import type { ChartLayout } from "@/features/home/types";
export interface WidgetDefinition {
  id: string;
  title: string;
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
    date: "proposal_creation_date",
    dueBy: "appr_deadline_date",
    title: "Proposals Awaiting Your Approval",
    module: "PROPOSALS",
    section: "needAttention",
    operation: "getProposalPendingApproval",
    orgHeader: "p_org_id",
    kind: "proposal",
  },
  {
    id: "cApproachingDeadlines",
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
    date: "eoi_creation_date",
    dueBy: "appr_deadline_date",
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
      title: "Total Proposals and Total Award Value by Year",
      module: "PROPOSALS",
      operation: "getPost_awardsAwardVsCostStatistics",
      renderType: "line",
      currency: true,
    },
    {
      id: "opportunityStatusChart",
      title: "Funding Opportunity Status",
      module: "opportunities-finder",
      operation: "getSharedGetOppFunnelStat",
      renderType: "funnel",
      mapping: "funnel",
      currency: true,
    },
    {
      id: "fundingByGrantChart",
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
      title: "Funding Efficiency Index",
      module: "PROPOSALS",
      operation: "getSharedGetWidgetParameters",
      renderType: "gauge",
      tokenHeader: "p_token",
      currency: true,
    },
    {
      id: "pByStatusChart",
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
