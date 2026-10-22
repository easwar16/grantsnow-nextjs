import { storage } from "@/server/session/storage";
import { assertActive } from "@/server/session/service";
import { failure, json } from "@/server/api/http";
/** The local session's expiry for the keep-alive timer (D37); reads the sealed cookie only, no Oracle call. */
export async function GET() {
  try {
    return json({ expiresAt: assertActive((await storage()).app).expiresAt });
  } catch (e) {
    return failure(e);
  }
}
