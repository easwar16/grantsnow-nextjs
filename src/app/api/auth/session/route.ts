import { storage } from "@/server/identity/session/storage";
import { assertActive } from "@/server/identity/session/service";
import { route } from "@/server/http/route";
/** The local session's expiry for the keep-alive timer (D37); reads the sealed cookie only, no Oracle call. */
export const GET = route(async () => ({
  expiresAt: assertActive((await storage()).app).expiresAt,
}));
