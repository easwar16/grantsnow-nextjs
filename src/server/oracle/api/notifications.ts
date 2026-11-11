import "server-only";
import { read, write } from "../client";
import { serverConstants } from "@/server/constants";

/**
 * The user's notifications: without a page as legacy loads them for the bell (held briefly), or one page of the
 * dashboard's Notifications tab (`p_offset` / `p_limit`, read with `{ fresh: true }` so a page is never the held copy).
 */
export const latest = read<{ offset: number; limit: number } | void, unknown>({
  op: "getNotificationsNotifications",
  ttl: serverConstants.ttl.access,
  query: (p) =>
    p ? { p_offset: String(p.offset), p_limit: String(p.limit) } : {},
});
/** WRITES: marks the given notifications read (legacy header, on closing the bell). */
export const markRead = write<{ ids: number[] }>({
  op: "postNotificationsNotifications",
  body: (p) => ({ items: p.ids.map((id) => ({ id, is_read: "Y" })) }),
  invalidates: ["getNotificationsNotifications"],
});
