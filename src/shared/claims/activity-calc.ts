/**
 * Legacy claims-unit-activities calculations (salaryParametersChange, hourlyParametersChange, costFieldsChanged,
 * costCategoryChanged, calculateRateChange, calculateAmountChange). Percentages are whole numbers here (50 = 50%),
 * as the backend stores and returns them; legacy held fractions in the page and multiplied by 100 to send.
 */
export interface PositionFigures {
  salaryType: string;
  totalSalary: number | null;
  deductSalary: number | null;
  hourlyRate: number | null;
  hoursPerDay: number | null;
  daysPerYear: number | null;
  salaryPercent: number | null;
  deductBenefit: number | null;
  benefitPercent: number | null;
  deductService: number | null;
  servicePercent: number | null;
  items: { type: string; amount: number | null }[];
}
const n = (v: number | null | undefined) => v ?? 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** HOURLY: rate × hours per day × days per year; otherwise the salary as entered. */
export const totalSalaryOf = (p: PositionFigures) =>
  p.salaryType === "HOURLY"
    ? round2(n(p.hourlyRate) * n(p.hoursPerDay) * n(p.daysPerYear))
    : n(p.totalSalary);

/** A cost line's lines of one type summed (legacy getCostItemTotal). */
export const itemsTotal = (
  items: PositionFigures["items"],
  type: "BENEFIT" | "PURCHASE_SERVICE",
) => round2(items.reduce((t, i) => (i.type === type ? t + n(i.amount) : t), 0));

/** The position's derived amounts: total × % − deduction, for the salary and for each line type. */
export function positionAmounts(p: PositionFigures) {
  const total = totalSalaryOf(p);
  return {
    totalSalary: total,
    salary: round2((total * n(p.salaryPercent)) / 100 - n(p.deductSalary)),
    benefits: round2(
      (itemsTotal(p.items, "BENEFIT") * n(p.benefitPercent)) / 100 -
        n(p.deductBenefit),
    ),
    purchase: round2(
      (itemsTotal(p.items, "PURCHASE_SERVICE") * n(p.servicePercent)) / 100 -
        n(p.deductService),
    ),
  };
}

/** Percent of Salary: the amount from the rate. */
export const itemAmountOf = (totalSalary: number, ratePercent: number | null) =>
  round2((totalSalary * n(ratePercent)) / 100);
/** Flat Amount: the rate from the amount (0 without a salary). */
export const itemRateOf = (totalSalary: number, amount: number | null) =>
  totalSalary ? round2((n(amount) / totalSalary) * 100) : 0;

/** A line's amount now: Flat Amount as typed; Percent of Salary from the current salary, so totals never go stale. */
export const lineAmountOf = (
  totalSalary: number,
  method: string,
  ratePercent: number | null,
  amount: number | null,
) =>
  method === "FLAT_AMOUNT" ? n(amount) : itemAmountOf(totalSalary, ratePercent);
