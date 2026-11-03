import { bell, markAllRead } from "@/server/modules/notifications/service";
import { route } from "@/server/http/route";
export const GET = route(() => bell());
/** The bell popup closed: mark the user's unread notifications read (no body; ids are resolved server-side). */
export const POST = route(() => markAllRead(), { write: true });
