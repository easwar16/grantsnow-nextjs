import "server-only";
import type { Operation } from "@/server/api/transport";
export interface WidgetDefinition {
  id: string;
  title: string;
  module: string;
  section: "needAttention" | "insights";
  operation: Operation;
  orgHeader: "p_org_id" | "org_id";
  chartType?: string;
  kind: "proposal" | "contract" | "ethics" | "award" | "eoi" | "statistics";
}
export const widgets: WidgetDefinition[] = [
  {
    id: "pApproachingDeadlines",
    title: "Proposals Approaching Deadlines",
    module: "PROPOSALS",
    section: "needAttention",
    operation: "getProposalProp_appr_deadline",
    orgHeader: "p_org_id",
    kind: "proposal",
  },
  {
    id: "pPendingApprovals",
    title: "Proposals Awaiting Your Approval",
    module: "PROPOSALS",
    section: "needAttention",
    operation: "getProposalPendingApproval",
    orgHeader: "p_org_id",
    kind: "proposal",
  },
  {
    id: "cApproachingDeadlines",
    title: "Contract deadlines",
    module: "CONTRACTS",
    section: "needAttention",
    operation: "getContractsContract_appr_deadline",
    orgHeader: "p_org_id",
    kind: "contract",
  },
  {
    id: "cPendingApprovals",
    title: "Contracts awaiting approval",
    module: "CONTRACTS",
    section: "needAttention",
    operation: "getContractsContractPendingApproval",
    orgHeader: "p_org_id",
    kind: "contract",
  },
  {
    id: "eApproachingDeadlines",
    title: "Ethics deadlines",
    module: "ETHICS",
    section: "needAttention",
    operation: "getDynamicFormsApplApprDeadline2",
    orgHeader: "p_org_id",
    kind: "ethics",
  },
  {
    id: "ePendingApprovals",
    title: "Ethics awaiting approval",
    module: "ETHICS",
    section: "needAttention",
    operation: "getDynamicFormsApplPendingApproval",
    orgHeader: "p_org_id",
    kind: "ethics",
  },
  {
    id: "aPendingApprovals",
    title: "Awards awaiting approval",
    module: "AWARDS",
    section: "needAttention",
    operation: "getPost_awardsAwardPendingApproval",
    orgHeader: "org_id",
    kind: "award",
  },
  {
    id: "aApprovedAwards",
    title: "Approved awards",
    module: "AWARDS",
    section: "needAttention",
    operation: "getPost_awardsApprovedAwards",
    orgHeader: "org_id",
    kind: "award",
  },
  {
    id: "eoiPendingApprovals",
    title: "EOI awaiting approval",
    module: "opportunities-eoi-list",
    section: "needAttention",
    operation: "getEoiPendingApproval",
    orgHeader: "p_org_id",
    kind: "eoi",
  },
  ...[
    [
      "pByYearChart",
      "Proposals by year and status",
      "PROPOSALS",
      "getProposalGetProposalStatistics",
      "YEAR_STATUS",
    ],
    [
      "pByStatusChart",
      "Proposals by status",
      "PROPOSALS",
      "getProposalGetProposalStatistics",
      "PROP_STATUS",
    ],
    [
      "pByFacultyChart",
      "Proposals by faculty",
      "PROPOSALS",
      "getProposalGetProposalStatistics",
      "PROP_FACULTY",
    ],
    [
      "aByStatusChart",
      "Awards by status",
      "AWARDS",
      "getPost_awardsAwardStatistics",
      "AWARD_STATUS",
    ],
    [
      "aByFacultyChart",
      "Awards by faculty",
      "AWARDS",
      "getPost_awardsAwardStatistics",
      "AWARD_FACULTY",
    ],
    [
      "eByStatusChart",
      "Ethics by status",
      "ETHICS",
      "getDynamicFormsApplicationStatistics",
      "ETHICS_STATUS",
    ],
    [
      "eByOrgChart",
      "Ethics by organization",
      "ETHICS",
      "getDynamicFormsApplicationStatistics",
      "ETHICS_ORG",
    ],
    [
      "eByRiskChart",
      "Ethics by risk",
      "ETHICS",
      "getDynamicFormsApplicationStatistics",
      "ETHICS_RISK",
    ],
  ].map(([id, title, module, operation, chartType]) => ({
    id,
    title,
    module,
    section: "insights" as const,
    operation: operation as Operation,
    orgHeader: "p_org_id" as const,
    chartType,
    kind: "statistics" as const,
  })),
];
