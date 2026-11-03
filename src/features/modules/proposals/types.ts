import type { ProposalQuery } from "./schemas";
export interface ProposalRow {
  id: string;
  reference: string;
  title: string;
  status: string;
  type: string;
  parentId?: number | null;
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
/** The listing's filters, each with its RB label, or null when its `list-*` entry is not visible. */
export type FilterLabels = Record<
  | "investigator"
  | "category"
  | "reference"
  | "search"
  | "department"
  | "sponsor"
  | "assignedTo"
  | "activityType"
  | "proposalCategory"
  | "tags"
  | "from"
  | "to",
  string | null
>;
export interface Column {
  key: Exclude<keyof ProposalRow, "parentId">;
  label: string;
}
export interface ProposalPage {
  rows: ProposalRow[];
  total?: number;
  hasMore: boolean;
  offset: number;
  query: ProposalQuery;
}
