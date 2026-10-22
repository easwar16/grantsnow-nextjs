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
