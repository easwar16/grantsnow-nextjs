import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { notifications } from "@/server/oracle/api";
import { forgetOperation } from "@/server/oracle/cache";
import { sanitizeHtml } from "@/server/platform/sanitize";
// The original bell popup lists the five latest.
const POPUP_ITEMS = 5;
export interface BellNotification {
  id: number;
  /** Repaired and sanitised backend HTML. */
  html: string;
  /** ISO instant; the client groups by its own local day. */
  at: string;
}
export interface Bell {
  unread: number;
  latest: BellNotification[];
}
const rows = z.object({
  items: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      is_read: z.string().nullish(),
      notific_content: z.string().nullish(),
      datetime: z.string().nullish(),
    }),
  ),
});
/**
 * Legacy renderNotificationAsHTML: repairs links whose query lost its `&` separators
 * (`?a=b=mode=shell=module=page` → `?a=b&mode=…&page=shell&shell=module&module=page`).
 */
export function repairNotificationHtml(html: string | null | undefined) {
  if (!html) return "";
  return html.replace(
    /href=(["'])([^"']+)\1/gi,
    (match, quote: string, href: string) => {
      const q = href.indexOf("?");
      if (q === -1) return match;
      const query = href.substring(q + 1);
      if (query.includes("&")) return match;
      const p = query.split("=");
      if (p.length !== 6 || p[3] !== "shell") return match;
      const e = encodeURIComponent;
      const fixed = `${e(p[0])}=${e(p[1])}&mode=${e(p[2])}&page=${e(p[3])}&shell=${e(p[4])}&${e(p[4])}=${e(p[5])}`;
      return `href=${quote}${href.substring(0, q + 1)}${fixed}${quote}`;
    },
  );
}
/** The backend stores UTC but usually sends no zone designator. */
export const utcOf = (datetime: string) =>
  /[zZ]|[+-]\d\d:?\d\d$/.test(datetime) ? datetime : `${datetime}Z`;
/** The user's notifications, held briefly and shared by the bell and the Notifications tab (VBCS shell cache, 9326). */
async function list(fresh = false) {
  const { session } = await authenticate();
  if (fresh) forgetOperation("getNotificationsNotifications", session.token);
  return {
    token: session.token,
    items: rows.parse(
      await notifications.latest(undefined, { token: session.token }),
    ).items,
  };
}
/** The bell: unread count over the list legacy loads (no paging params), and the latest five for the popup. */
export async function bell(): Promise<Bell> {
  const { items } = await list();
  return {
    unread: items.filter((n) => n.is_read === "N").length,
    latest: items.slice(0, POPUP_ITEMS).flatMap((n) => {
      const at = utcOf(n.datetime ?? "");
      return Number.isFinite(Date.parse(at))
        ? [
            {
              id: n.id,
              html: sanitizeHtml(repairNotificationHtml(n.notific_content)),
              at,
            },
          ]
        : [];
    }),
  };
}
/**
 * Closing the popup marks every unread notification read (legacy header, GN-Angular closeBell). The ids come
 * from the user's own list on the server, never from the browser.
 */
export async function markAllRead() {
  // Fresh ids, so nothing that arrived inside the hold is skipped.
  const { token, items } = await list(true);
  const unread = items.filter((n) => n.is_read === "N").map((n) => n.id);
  if (unread.length === 0) return { marked: 0 };
  await notifications.markRead({ ids: unread }, { token }).catch((e) => {
    // A failed write may still have landed, so the held list is dropped either way.
    forgetOperation("getNotificationsNotifications", token);
    throw e;
  });
  return { marked: unread.length };
}
