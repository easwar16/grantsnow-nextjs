import type { OpportunityQuery } from "./schemas";
export interface OpportunityRow {
  id: string;
  title: string;
  url?: string;
  status: string;
  funders?: string;
  coFunders?: string;
  site?: string;
  logo?: string;
  fundingType?: string;
  totalFund?: string;
  currency?: string;
  published?: string;
  opening?: string;
  closing?: string;
  applications?: number;
  proposals?: number;
  outlines?: number;
  summary?: string;
  bookmarked: boolean;
}
export interface OpportunityPage {
  rows: OpportunityRow[];
  total: number;
  hasMore: boolean;
  query: OpportunityQuery;
}
