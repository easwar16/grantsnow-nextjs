import * as oidc from "openid-client";
import { storage, takeIdToken } from "@/server/identity/session/storage";
import { clearSession } from "@/server/identity/session/service";
import { idcs } from "@/server/identity/auth/oidc";
import {
  appOrigin,
  fixtureMode,
  browserSessionMode,
  oidcSettings,
} from "@/server/platform/configuration/environment";
import { failure } from "@/server/http/response";
import { functions } from "@/lib/functions";
export async function POST(request: Request) {
  try {
    functions.security.sameOrigin(request, appOrigin());
    const idToken = await takeIdToken();
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
        // IDCS answers "Invalid logout request" without id_token_hint (verified 2026-11-04), so it is sent.
        if (config.serverMetadata().end_session_endpoint && idToken) {
          const url = oidc.buildEndSessionUrl(config, {
            client_id: oidcSettings().clientId,
            id_token_hint: idToken,
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
