import { calendarDate } from "@/lib/format";
const DAY_MS = 86_400_000;
/** Whole calendar days from today (local) to the value's calendar date; null when absent or unparseable. */
export function calendarDaysUntil(value?: string, today = new Date()) {
  const due = calendarDate(value);
  if (!due) return null;
  return Math.round(
    (Date.UTC(due.year, due.month - 1, due.day) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      DAY_MS,
  );
}
/** Legacy `getDateDiff(date) <= 0` intent on calendar days: due today or earlier. A missing date is never overdue. */
export function isOverdue(value?: string, today = new Date()) {
  const days = calendarDaysUntil(value, today);
  return days !== null && days <= 0;
}
