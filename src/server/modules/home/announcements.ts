import "server-only";
import { z } from "zod";
import { homeAccess } from "./service";
import { home } from "@/server/oracle/api";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
/** One module's announcements (DASHBOARD, OPPORTUNITIES), sanitised; the caller has already checked its access. */
export async function announcementMessages(token: string, module: string) {
  try {
    const body = z
      .object({ items: z.array(z.object({ msg: z.unknown() })) })
      .parse(
        // Home and the finder both show them; held briefly per module.
        await home.announcements({ module }, { token }),
      );
    // A bad row is dropped on its own; it does not blank the whole strip.
    return {
      messages: body.items.flatMap(({ msg }) =>
        typeof msg === "string" && msg.trim() !== "" && msg.length <= 100000
          ? [serverFunctions.sanitize.sanitizeHtml(msg)]
          : [],
      ),
    };
  } catch (e) {
    return {
      messages: [] as string[],
      error: functions.errors.publicError(e).message,
    };
  }
}
export async function loadAnnouncements() {
  const { session } = await homeAccess();
  return announcementMessages(session.token, "DASHBOARD");
}
