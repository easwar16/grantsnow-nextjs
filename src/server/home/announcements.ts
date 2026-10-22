import "server-only";
import { sanitizeHtml } from "@/server/html/sanitize";
import { z } from "zod";
import { homeAccess } from "./service";
import { publicError } from "@/lib/errors";
import { cachedRead } from "@/server/cache/reads";
import { TTL } from "@/server/cache/memo";
/** One module's announcements (DASHBOARD, OPPORTUNITIES), sanitised; the caller has already checked its access. */
export async function announcementMessages(token: string, module: string) {
  try {
    const body = z
      .object({ items: z.array(z.object({ msg: z.string().max(100000) })) })
      .parse(
        // Home and the finder both show them; held briefly per module.
        await cachedRead(
          "getSharedAnnouncements",
          { token, module_name: module },
          TTL.access,
        ),
      );
    return { messages: body.items.map((r) => sanitizeHtml(r.msg)) };
  } catch (e) {
    return { messages: [] as string[], error: publicError(e).message };
  }
}
export async function loadAnnouncements() {
  const { session } = await homeAccess();
  return announcementMessages(session.token, "DASHBOARD");
}
