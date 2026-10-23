import "server-only";
import { read, write, type PageParams } from "../client";
import { TTL } from "../cache";

/** The user's notifications as legacy loads them for the bell (no paging parameters), held briefly. */
export const latest = read<void, unknown>({
  op: "getNotificationsNotifications",
  ttl: TTL.access,
});
/** One page of the dashboard's Notifications tab (`p_offset` / `p_limit`). */
export const page = read<PageParams, unknown>({
  op: "getNotificationsNotifications",
  pages: "page",
});
/** WRITES: marks the given notifications read (legacy header, on closing the bell). */
export const markRead = write<{ ids: number[] }>({
  op: "postNotificationsNotifications",
  body: (p) => ({ items: p.ids.map((id) => ({ id, is_read: "Y" })) }),
  invalidates: ["getNotificationsNotifications"],
});
