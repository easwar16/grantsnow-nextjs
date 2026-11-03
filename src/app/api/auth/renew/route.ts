import { renewSession } from "@/server/identity/session/service";
import { route } from "@/server/http/route";
export const POST = route(async () => ({ expiresAt: await renewSession() }), {
  write: true,
});
