/** One linked due-diligence record as the tab lists it; only fields whose label is visible are present. */
export interface DueDiligenceRecord {
  id: string;
  number: string;
  status?: string;
  tone?: "info" | "success";
  title: string;
  fields: { key: string; label: string; value: string; date: boolean }[];
}
export interface DueDiligenceView {
  records: DueDiligenceRecord[];
  texts: { empty: string };
}
