import type { ParentDueDiligenceTexts } from "@/features/record/linked/model";

/** One linked due-diligence record as the tab lists it; only fields whose label is visible are present. */
export interface DueDiligenceRecord {
  id: string;
  number: string;
  status?: string;
  tone?: "info" | "success";
  title: string;
  fields: { key: string; label: string; value: string; date: boolean }[];
  /** The record in its own access view (legacy title click and View). */
  href?: string;
}
export interface DueDiligenceView {
  records: DueDiligenceRecord[];
  parentId: string;
  canCreate: boolean;
  canLink: boolean;
  texts: { empty: string; view: string | null };
  /** Create and Link Due Diligence (legacy award bundle keys). */
  parentTexts: ParentDueDiligenceTexts;
}
