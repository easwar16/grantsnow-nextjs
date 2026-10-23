/** Insights Years / Quarter / Months options and the quarter → month rule (GN-Angular insights.ts). */
export interface FilterOption {
  value: string;
  label: string;
}
// Legacy offers the current year back to 1995.
const FIRST_YEAR = 1995;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const QUARTERS: FilterOption[] = [
  "Q1 (Jan - Mar)",
  "Q2 (Apr - Jun)",
  "Q3 (Jul - Sep)",
  "Q4 (Oct - Dec)",
].map((label, i) => ({ value: String(i + 1), label }));
export const yearOptions = (currentYear: number): FilterOption[] =>
  Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));
const quarterOf = (month: string) => String(Math.ceil(Number(month) / 3));
const inQuarters = (month: string, quarters: string[]) =>
  quarters.length === 0 || quarters.includes(quarterOf(month));
/** The Months list narrows to the chosen quarters; no quarter means all twelve. */
export const monthOptions = (quarters: string[]): FilterOption[] =>
  MONTHS.map((label, i) => ({ value: String(i + 1), label })).filter((m) =>
    inQuarters(m.value, quarters),
  );
/** Narrowing quarters drops chosen months outside them (legacy left them selected). */
export const pruneMonths = (months: string[], quarters: string[]) =>
  months.filter((m) => inQuarters(m, quarters));
