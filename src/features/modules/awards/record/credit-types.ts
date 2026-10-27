/** One credit allocation row as the tab shows it; credit and effort are fractions (1 = 100%). */
export interface CreditRow {
  id: string;
  person: string;
  role: string;
  credit: number;
  effort: number;
}
export interface CreditView {
  awardId: string;
  rows: CreditRow[];
  /** A draft whose Credit Allocation page is editable and not locked or finalized. */
  canEdit: boolean;
  texts: Record<
    | "person"
    | "role"
    | "credit"
    | "effort"
    | "title"
    | "edit"
    | "save"
    | "cancel"
    | "noData"
    | "overAllocated",
    string
  >;
}
