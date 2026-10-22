import "server-only";
import { sanitizeHtml } from "@/server/html/sanitize";
import { z } from "zod";
import { homeAccess } from "./service";
import { oracle } from "@/server/api/transport";
import { publicError } from "@/lib/errors";
export async function loadAnnouncements() {
  const { session } = await homeAccess();
  try {
    const body = z
      .object({ items: z.array(z.object({ msg: z.string().max(100000) })) })
      .parse(
        await oracle("getSharedAnnouncements", {
          token: session.token,
          module_name: "DASHBOARD",
        }),
      );
    return { messages: body.items.map((r) => sanitizeHtml(r.msg)) };
  } catch (e) {
    return { messages: [] as string[], error: publicError(e).message };
  }
}
