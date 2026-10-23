// app-flow.js diffInMonthsDecimal / calculateEndDate, as GN-Angular ported them: calendar months, end date inclusive.
import { calendarDaysUntil } from "@/features/home/deadline";
const DAY_MS = 86_400_000;
/** `t` (UTC ms) plus `n` calendar months, the day clamped to the target month (31 Jan + 1 → 28/29 Feb). */
function plusMonths(t: number, n: number) {
  const d = new Date(t);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0),
  ).getUTCDate();
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + n,
    Math.min(d.getUTCDate(), last),
  );
}
const daysInMonthOf = (t: number) =>
  new Date(
    Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 0),
  ).getUTCDate();
/** The year of an ISO date, or NaN. */
export const yearOf = (iso: string) =>
  new Date(Date.parse(iso)).getUTCFullYear();
/** Calendar months from `start` to `end`, both days included (1 Jan to 31 Dec is 12), to `decimals` places. */
export function monthsBetween(start: string, end: string, decimals: number) {
  const s = Date.parse(start),
    endExcl = Date.parse(end) + DAY_MS;
  if (Number.isNaN(s) || Number.isNaN(endExcl)) return null;
  const a = new Date(s),
    b = new Date(endExcl);
  let whole =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth());
  let anchor = plusMonths(s, whole);
  if (endExcl < anchor) anchor = plusMonths(s, --whole);
  const span = plusMonths(anchor, 1) - anchor;
  return Number((whole + (endExcl - anchor) / span).toFixed(decimals));
}
/** The inclusive end date `months` after `start` (12 from 1 Jan is 31 Dec); a fraction adds days of the last month. */
export function endDateAfter(start: string, months: number, decimals: number) {
  const s = Date.parse(start);
  if (Number.isNaN(s)) return null;
  const rounded = Number(months.toFixed(decimals)),
    whole = Math.floor(rounded);
  let end = plusMonths(s, whole);
  const fraction = rounded - whole;
  if (fraction > 0) end += Math.round(fraction * daysInMonthOf(end)) * DAY_MS;
  return new Date(end - DAY_MS).toISOString().slice(0, 10);
}
/** The deadline warning (8203): the closing date is today or within `days` calendar days. */
export function nearDeadline(
  closing: string | undefined,
  days: number | null,
  today = new Date(),
) {
  if (days === null) return false;
  // Calendar days, so the closing day itself still warns (legacy compared instants, skipping it).
  const left = calendarDaysUntil(closing, today);
  return left !== null && left >= 0 && left <= days;
}
