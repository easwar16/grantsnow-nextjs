/**
 * The shared FX Rates panel (legacy fragment `fx-rates`, hosted by the proposal Budget and Pricing tabs): one row per
 * currency of `getProposalFxRates`, as the server maps it for the browser.
 */
export const FX_MODES = ["PURCHASE", "INCOME"] as const;
/** PURCHASE on Budget edits the cost rate; INCOME on Pricing edits the price rate (legacy `objectType`). */
export type FxMode = (typeof FX_MODES)[number];
export const ADMIN_DEFAULT = "ADMIN_DEFAULT";
export const OVERRIDDEN = "OVERRIDDEN";
export interface FxRate {
  rateId: number | null;
  currency: string;
  name: string;
  cost: number | null;
  price: number | null;
  defaultCost: number | null;
  defaultPrice: number | null;
  /** ADMIN_DEFAULT, or OVERRIDDEN once a rate was changed. */
  status: string;
}
/** One currency's pending change: a reset to the defaults, then (optionally) a new rate for the mode's column. */
export interface FxEdit {
  currency: string;
  reset: boolean;
  rate?: number;
}
export type FxText =
  | "title"
  | "currency"
  | "cost"
  | "price"
  | "save"
  | "reset"
  | "edited"
  | "noData";
export interface FxView {
  rates: FxRate[];
  /** Every gate passed on the server; otherwise the panel is read-only and has no Save. */
  editable: boolean;
  mode: FxMode;
  texts: Record<FxText, string>;
}
/** The column a mode may change (legacy freezes the other: INCOME the cost rate, PURCHASE the price rate). */
export const editedColumn = (mode: FxMode) =>
  mode === "PURCHASE" ? "cost" : "price";
/** Legacy updateGridData: RESET restores both defaults (1 when none); a rate overrides the mode's column. */
export function applyEdit(rate: FxRate, edit: FxEdit, mode: FxMode): FxRate {
  let next = rate;
  if (edit.reset)
    next = {
      ...next,
      cost: next.defaultCost ?? 1,
      price: next.defaultPrice ?? 1,
      status: ADMIN_DEFAULT,
    };
  if (edit.rate !== undefined)
    next = { ...next, [editedColumn(mode)]: edit.rate, status: OVERRIDDEN };
  return next;
}
/** The rows with every pending edit applied (both the screen and the server's save body use this). */
export function withEdits(
  rates: FxRate[],
  edits: Record<string, FxEdit>,
  mode: FxMode,
): FxRate[] {
  return rates.map((r) => {
    const edit = edits[r.currency];
    return edit ? applyEdit(r, edit, mode) : r;
  });
}
