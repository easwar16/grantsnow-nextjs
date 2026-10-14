import { capturedBrowserSession } from "@/server/session/browser-session";
import * as oidc from "openid-client";
import {
  appOrigin,
  fixtureMode,
  browserSessionMode,
  oidcSettings,
} from "@/server/configuration/environment";
import { idcs } from "@/server/auth/oidc";
import { storage } from "@/server/session/storage";
import { oracle } from "@/server/api/transport";
import { mapBootstrap } from "@/server/session/contracts";
import { safeReturn, sameOrigin } from "@/lib/security";
import { failure } from "@/server/api/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const returnTo = safeReturn((await request.formData()).get("returnTo"));
    let store = await storage();
    store.destroy();
    store = await storage();
    if (browserSessionMode()) {
      const b = await capturedBrowserSession();
      store.app = {
        token: b.token,
        expiresAt: b.expiresAt,
        subject: `dev-backend:${b.user.personId}`,
        identityExpiresAt: b.backendExpiresAt,
        fixture: false,
        source: "browser-session",
      };
      await store.save();
      return Response.redirect(new URL(returnTo, appOrigin()), 303);
    }
    if (fixtureMode()) {
      const b = mapBootstrap(
        await oracle("getSessionLogin", { username: "fixture.researcher" }),
      );
      store.app = {
        token: b.token,
        expiresAt: b.expiresAt,
        subject: "fixture-subject",
        identityExpiresAt: Date.now() + 8 * 3600000,
        fixture: true,
      };
      await store.save();
      return Response.redirect(new URL(returnTo, appOrigin()), 303);
    }
    const config = await idcs(),
      verifier = oidc.randomPKCECodeVerifier(),
      state = oidc.randomState(),
      nonce = oidc.randomNonce();
    store.transaction = {
      verifier,
      state,
      nonce,
      returnTo,
      expiresAt: Date.now() + 10 * 60000,
    };
    await store.save();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: `${appOrigin()}/api/auth/callback`,
      scope: oidcSettings().scopes,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    });
    return Response.redirect(url, 303);
  } catch (e) {
    return failure(e);
  }
}
