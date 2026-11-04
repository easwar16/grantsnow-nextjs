export interface HomeFilters {
  organization?: string;
  year?: string;
  quarter?: string;
  month?: string;
  offset: number;
}
export interface AttentionRow {
  id: string;
  reference: string;
  title: string;
  context?: string;
  createdBy?: string;
  sponsor?: string;
  deadlineDescription?: string;
  deadlineType?: string;
  age?: string;
  value?: string;
  currency?: string;
  date?: string;
  overdue?: boolean;
  stage?: string;
  href: string;
  /** Ethics rows open only after the legacy checkApplApprAccess allows it. */
  ethics?: boolean;
}
export interface StatisticRow {
  id: string;
  label: string;
  series?: string;
  value: number;
  /** The listing a click on this row opens. */
  href?: string;
}
/** Axis titles, stacking and legend of a legacy oj-chart. */
export interface ChartLayout {
  xTitle?: string;
  yTitle?: string;
  y2Title?: string;
  stack?: boolean;
  legend?: boolean;
  /** Every category label, turned 90° (a plain oj-chart bar with many groups, e.g. Opportunities Analytics). */
  rotateLabels?: boolean;
  /** One-decimal percentages inside the slices (a plain oj-chart pie, e.g. Opportunities Analytics). */
  insideLabels?: boolean;
  /** A title above a pie's legend (oj-chart `legend.title`); unnamed slices then have no legend entry. */
  legendTitle?: string;
}
export interface WidgetData {
  presentation?: ChartLayout & {
    type:
      | "bar"
      | "pie"
      | "line"
      | "scatter"
      | "funnel"
      | "gauge"
      | "combo"
      | "area";
    columns: number;
    currency?: string;
  };
  gauge?: { value: number; low: number; medium: number; target: number };
  attention: AttentionRow[];
  statistics: StatisticRow[];
  hasMore: boolean;
  offset: number;
}
export type WidgetResult =
  | { ok: true; data: WidgetData }
  | { ok: false; error: { code: string; message: string; action?: string } };
