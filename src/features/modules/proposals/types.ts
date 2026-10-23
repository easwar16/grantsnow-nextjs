import type { ProposalQuery } from "./schemas";
export interface ProposalRow {
  id: string;
  reference: string;
  title: string;
  status: string;
  type: string;
  investigator?: string;
  statusCode?: string;
  risk?: string;
  riskCode?: string;
  applicant?: string;
  assignedTo?: string;
  activity?: string;
  category?: string;
  updated?: string;
  tags?: string;
  organization?: string;
  sponsor?: string;
  created?: string;
  start?: string;
  end?: string;
  value?: string;
  currency?: string;
}
export interface Column {
  key: keyof ProposalRow;
  label: string;
}
export interface ProposalPage {
  rows: ProposalRow[];
  total?: number;
  hasMore: boolean;
  offset: number;
  query: ProposalQuery;
}
