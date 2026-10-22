import { bell, markAllRead } from "@/server/notifications/service";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
export async function GET() {
  try {
    return json(await bell());
  } catch (e) {
    return failure(e);
  }
}
/** The bell popup closed: mark the user's unread notifications read (no body; ids are resolved server-side). */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    return json(await markAllRead());
  } catch (e) {
    return failure(e);
  }
}
