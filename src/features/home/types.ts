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
  href?: string;
}
export interface StatisticRow {
  id: string;
  label: string;
  series?: string;
  value: number;
}
export interface WidgetData {
  attention: AttentionRow[];
  statistics: StatisticRow[];
  hasMore: boolean;
  offset: number;
}
export type WidgetResult =
  | { ok: true; data: WidgetData }
  | { ok: false; error: { code: string; message: string } };
