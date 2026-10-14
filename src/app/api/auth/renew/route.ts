import { renewSession } from "@/server/session/service";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { failure, json } from "@/server/api/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    return json({ expiresAt: await renewSession() });
  } catch (e) {
    return failure(e);
  }
}
