import type { OpportunityQuery } from "./schemas";
export interface OpportunityRow {
  id: string;
  title: string;
  url?: string;
  status: string;
  funders?: string[];
  coFunders?: string[];
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
export const opportunityDateKeys = [
  "publication-date",
  "opening-date",
  "closing-date",
] as const;
export type OpportunityLabelKey =
  | (typeof opportunityDateKeys)[number]
  | "funding-type"
  | "total-fund"
  | "aoi-count"
  | "proposals-count"
  | "outline-proposals-count"
  | "not-available"
  | "check-website"
  | "more-info";
/** Labels from the opener's RB bundle and the date columns its gates show (one card, D32). */
export interface OpportunityCardModel {
  labels: Record<OpportunityLabelKey, string>;
  dates: (typeof opportunityDateKeys)[number][];
}
export interface OpportunityPage {
  card: OpportunityCardModel;
  rows: OpportunityRow[];
  total: number;
  hasMore: boolean;
  query: OpportunityQuery;
  /** The access read behind the count cells failed, so they are hidden; the UI says so. */
  countsUnavailable?: true;
}
