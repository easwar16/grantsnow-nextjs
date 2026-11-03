import moment from "moment";
import { functions } from "@/lib/functions";

/** Whole calendar days from today (local) to the value's calendar date; null when absent or unparseable. */
export function calendarDaysUntil(value?: string, today = new Date()) {
  if (!functions.format.calendarDate(value)) return null;
  // Both sides as calendar dates in UTC, so neither the time of day nor a DST change moves the count.
  const due = moment.utc(value!.slice(0, 10), "YYYY-MM-DD"),
    now = moment.utc([today.getFullYear(), today.getMonth(), today.getDate()]);
  return due.diff(now, "days");
}
/** Legacy `getDateDiff(date) <= 0` intent on calendar days: due today or earlier. A missing date is never overdue. */
export function isOverdue(value?: string, today = new Date()) {
  const days = calendarDaysUntil(value, today);
  return days !== null && days <= 0;
}
