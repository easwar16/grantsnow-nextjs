import type { StatisticRow } from "@/features/modules/home/types";

export interface ReportYear {
  cost_period: string;
  budget: number;
  actual: number;
  variance: number;
  forecast: number;
}
/** One funding header and its lines, by month (legacy tMonthlySplit tree). */
export interface ReportMonth {
  id: string;
  name: string;
  total: number;
  children: { id: string; name: string; values: Record<string, number> }[];
}
export interface ReportView {
  /** The reported project's number; null when the award has no project. */
  project: string | null;
  chart: StatisticRow[];
  years: ReportYear[];
  months: { columns: { key: string; label: string }[]; rows: ReportMonth[] };
  texts: Record<
    | "projectNumber"
    | "totalBudget"
    | "ptdTotal"
    | "chart"
    | "table"
    | "costPeriod"
    | "budget"
    | "actual"
    | "variance"
    | "forecast"
    | "total"
    | "monthly"
    | "name"
    | "noData",
    string
  >;
}

/** Legacy yearly fetch: the footer and the tile sum the years. */
export function reportTotals(years: ReportYear[]) {
  const sum = (k: Exclude<keyof ReportYear, "cost_period">) =>
    years.reduce((a, y) => a + y[k], 0);
  return {
    budget: sum("budget"),
    actual: sum("actual"),
    variance: sum("variance"),
    forecast: sum("forecast"),
  };
}
