// Legacy app-flow.js diffInMonthsDecimal / calculateEndDate, in moment as legacy computes them: calendar months, end inclusive.
import moment from "moment";
import { calendarDaysUntil } from "@/features/modules/home/deadline";
/** The year of an ISO date, or NaN. */
export const yearOf = (iso: string) => {
  const m = moment.utc(iso, moment.ISO_8601);
  return m.isValid() ? m.year() : NaN;
};
/** Calendar months from `start` to `end`, both days included (1 Jan to 31 Dec is 12), to `decimals` places. */
export function monthsBetween(start: string, end: string, decimals: number) {
  const from = moment.utc(start, moment.ISO_8601).startOf("day"),
    endExcl = moment.utc(end, moment.ISO_8601).add(1, "day").startOf("day");
  if (!from.isValid() || !endExcl.isValid()) return null;
  let whole =
    (endExcl.year() - from.year()) * 12 + (endExcl.month() - from.month());
  let anchor = from.clone().add(whole, "months");
  if (endExcl.isBefore(anchor)) anchor = from.clone().add(--whole, "months");
  const remaining = endExcl.diff(anchor, "days"),
    daysInPartial = anchor.clone().add(1, "months").diff(anchor, "days");
  return Number((whole + remaining / daysInPartial).toFixed(decimals));
}
/** The inclusive end date `months` after `start` (12 from 1 Jan is 31 Dec); a fraction adds days of the last month. */
export function endDateAfter(start: string, months: number, decimals: number) {
  const from = moment.utc(start, moment.ISO_8601);
  if (!from.isValid()) return null;
  const rounded = Number(months.toFixed(decimals)),
    whole = Math.floor(rounded),
    end = from.clone().add(whole, "months");
  if (rounded - whole > 0)
    end.add(Math.round((rounded - whole) * end.daysInMonth()), "days");
  return end.subtract(1, "day").format("YYYY-MM-DD");
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
