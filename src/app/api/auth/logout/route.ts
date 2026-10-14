import * as oidc from "openid-client";
import { storage } from "@/server/session/storage";
import { clearSession } from "@/server/session/service";
import { idcs } from "@/server/auth/oidc";
import {
  appOrigin,
  fixtureMode,
  browserSessionMode,
  oidcSettings,
} from "@/server/configuration/environment";
import { sameOrigin } from "@/lib/security";
import { failure } from "@/server/api/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const backendOk = await clearSession();
    const store = await storage();
    store.logoutStatus = backendOk ? "SIGNED_OUT" : "BACKEND_LOGOUT_FAILED";
    await store.save();
    const local = new URL(
      `/login?reason=${backendOk ? "SIGNED_OUT" : "BACKEND_LOGOUT_FAILED"}`,
      appOrigin(),
    );
    if (!fixtureMode() && !browserSessionMode()) {
      try {
        const config = await idcs();
        if (config.serverMetadata().end_session_endpoint) {
          // No tokens in URL. IDCS must support client_id + registered return URI.
          const url = oidc.buildEndSessionUrl(config, {
            client_id: oidcSettings().clientId,
            post_logout_redirect_uri: `${appOrigin()}/login`,
          });
          return Response.redirect(url, 303);
        }
      } catch {
        /* Local logout succeeds independently of discovery/IDCS. */
      }
      local.searchParams.set("idcs", "unavailable");
    }
    return Response.redirect(local, 303);
  } catch (e) {
    return failure(e);
  }
}
