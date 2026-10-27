/** One budget period as the tab shows and edits it (legacy `Award Budget Periods` row). */
export interface BudgetRow {
  /** BUDGET_PERIOD (e.g. BP_1); "" for a new one. */
  key: string;
  type: string;
  start: string;
  end: string;
  direct: number;
  indirect: number;
  sponsor: number;
  institution: number;
  total: number;
  erpId: string;
  editable: boolean;
}
export type BudgetAmount =
  "total" | "direct" | "indirect" | "sponsor" | "institution";
export type BudgetDraft = Omit<BudgetRow, "editable">;

/** Footer sums (legacy processAwardsData). */
export function budgetTotals(rows: BudgetRow[]) {
  const sum = (k: BudgetAmount) => rows.reduce((a, r) => a + r[k], 0);
  return {
    direct: sum("direct"),
    indirect: sum("indirect"),
    sponsor: sum("sponsor"),
    institution: sum("institution"),
    total: sum("total"),
  };
}

/** A part as a share of the total; 0 when there is no total (legacy gave Infinity). */
const share = (part: number, total: number) => (total ? part / total : 0);

/**
 * Legacy calculateContribution: editing one amount re-derives the others so direct + indirect and funder +
 * institution both make the total, keeping the current shares where the total moves (legacy updates its share
 * fields on every edit). A period with no total has no shares, so its parts start at 0 (legacy produced NaN).
 * Direct and indirect may now exceed the old total, as raising a part raises the total (legacy refused).
 */
export function recalc(
  d: BudgetDraft,
  changed: BudgetAmount,
  value: number,
): BudgetDraft {
  const directShare = share(d.direct, d.total),
    sponsorShare = share(d.sponsor, d.total);
  const next = { ...d, [changed]: value };
  if (changed === "total") {
    next.direct = directShare * value;
    next.indirect = value - next.direct;
    next.sponsor = sponsorShare * value;
    next.institution = value - next.sponsor;
  } else if (changed === "direct" || changed === "indirect") {
    next.total = next.direct + next.indirect;
    next.sponsor = sponsorShare * next.total;
    next.institution = next.total - next.sponsor;
  } else if (changed === "sponsor") next.institution = next.total - value;
  else next.sponsor = next.total - value;
  return next;
}

/**
 * Legacy getPeriodDateBound: a period date outside the award's range is ignored; of the award date and the period
 * date, the later (`latest`) or the earlier one bounds the other picker.
 */
export function periodBound(
  awardDate: string,
  periodDate: string,
  latest: boolean,
  otherAwardDate: string,
) {
  const lo = [awardDate, otherAwardDate].filter(Boolean).sort()[0] ?? "",
    hi = [awardDate, otherAwardDate].filter(Boolean).sort().at(-1) ?? "";
  const inRange =
    periodDate !== "" && (!lo || periodDate >= lo) && (!hi || periodDate <= hi);
  const dates = [awardDate, inRange ? periodDate : ""].filter(Boolean).sort();
  return (latest ? dates.at(-1) : dates[0]) ?? "";
}
