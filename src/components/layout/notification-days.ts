export interface NotificationDay<T> {
  /** 'Today', 'Yesterday', or null for an older day (shown as a date). */
  label: "Today" | "Yesterday" | null;
  /** The local calendar day, `YYYY-MM-DD`. */
  day: string;
  items: T[];
}
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Groups newest-first notifications by the viewer's local day, labelling today and yesterday (GN-Angular groupByDay). */
export function groupByDay<T extends { at: string }>(
  items: T[],
  now = new Date(),
): NotificationDay<T>[] {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const today = localDay(now),
    before = localDay(yesterday);
  const days = new Map<string, NotificationDay<T>>();
  for (const item of items) {
    const day = localDay(new Date(item.at));
    if (!days.has(day))
      days.set(day, {
        label: day === today ? "Today" : day === before ? "Yesterday" : null,
        day,
        items: [],
      });
    days.get(day)!.items.push(item);
  }
  return [...days.values()];
}
