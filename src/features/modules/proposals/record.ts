import { z } from "zod";
export const recordIdentity = z.object({
  type: z.enum([
    "PROPOSAL",
    "OUTLINE_PROPOSAL",
    "SUB_PROPOSAL",
    "EXTENSION_PROPOSAL",
  ]),
  id: z.string().regex(/^[1-9]\d{0,14}$/),
});
export type RecordIdentity = z.infer<typeof recordIdentity>;
export interface SummaryField {
  key: string;
  label: string;
  value: string;
  kind: "text" | "date";
}
export interface ProposalSummary {
  id: string;
  type: string;
  reference: string;
  title: string;
  status: string;
  statusCode: string;
  budgetVersionId: number | null;
  creatorId: number | null;
  lockedPageIds: number[];
  detailColumns: SummaryField[][];
  fields: SummaryField[];
  piFields: SummaryField[];
  proposalFields: SummaryField[];
  opportunityFields: SummaryField[];
  collaboratorAnswer: string | null;
  subproposalAnswer: string | null;
  collaborators: {
    id: string;
    name: string;
    role: string;
    description: string;
    countryCode: string;
    vatCode: string;
    costingEnabled: boolean;
  }[];
  subproposals: {
    id: string;
    type: string;
    name: string;
    orgUnit: string;
    role: string;
    excludePricing: boolean;
    proposalNumber: string;
  }[];
  attributes: Record<string, string>;
  sponsors: {
    id: string;
    name: string;
    funderType: string;
    type: string;
    roleCode: string;
    priority: string;
  }[];
  investigators: {
    id: string;
    name: string;
    role: string;
    organization: string;
  }[];
  deadlines: { id: string; type: string; description: string; date: string }[];
  labels: {
    sponsors: string;
    investigators: string;
    deadlines: string;
    noData: string;
    piDetails: string;
    proposalDetails: string;
    opportunityDetails: string;
    collaboratorDetails: string;
    subproposalDetails: string;
    collaboratorQuestion: string;
    subproposalQuestion: string;
    funderTypeVisible: boolean;
    funder: string;
    funderType: string;
    funderRole: string;
    priority: string;
  };
}
