/**
 * Legacy getTransDateValidators: the claim period's calendar month inside the fiscal year. The year starts in
 * `startMonth` (ACADEMIC_YEAR_MONTH) and ends in `fy`; a month at or after the start falls in the year before `fy`
 * (unless the year starts in January). Returns ISO dates, or null when an input is missing.
 */
export function claimPeriodRange(
  fy: string | number | null | undefined,
  claimMonth: string | number | null | undefined,
  startMonth: string | number | null | undefined,
): { start: string; end: string } | null {
  const endYear = Number.parseInt(String(fy ?? ""), 10);
  const claim = monthOf(claimMonth),
    start = monthOf(startMonth);
  if (!Number.isFinite(endYear) || claim === null || start === null)
    return null;
  const startYear = start === 1 ? endYear : endYear - 1;
  const year = claim >= start ? startYear : endYear;
  const last = new Date(Date.UTC(year, claim, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(claim)}-01`,
    end: `${year}-${pad(claim)}-${pad(last)}`,
  };
}
const NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
/** A month as 1–12 from a number, a numeric string or a month name (its first three letters), as legacy resolves it. */
export function monthOf(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (Number.isInteger(n)) return n >= 1 && n <= 12 ? n : null;
  const i = NAMES.indexOf(String(v).trim().slice(0, 3).toUpperCase());
  return i < 0 ? null : i + 1;
}
