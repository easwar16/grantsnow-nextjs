import {
  capturedBrowserSession,
  pastedBrowserSession,
} from "@/server/identity/session/browser-session";
import { AppError } from "@/lib/errors";
import * as oidc from "openid-client";
import {
  appOrigin,
  fixtureMode,
  browserSessionMode,
  oidcSettings,
} from "@/server/platform/configuration/environment";
import { idcs } from "@/server/identity/auth/oidc";
import { storage } from "@/server/identity/session/storage";
import { oracle } from "@/server/oracle/connection";
import { mapBootstrap } from "@/server/identity/session/contracts";
import { failure } from "@/server/http/response";
import { functions } from "@/lib/functions";
export async function POST(request: Request) {
  try {
    functions.security.sameOrigin(request, appOrigin());
    const form = await request.formData(),
      returnTo = functions.security.safeReturn(form.get("returnTo")),
      pasted = form.get("token");
    let store = await storage();
    store.destroy();
    store = await storage();
    if (browserSessionMode()) {
      let b;
      try {
        b =
          typeof pasted === "string" && pasted.trim() !== ""
            ? await pastedBrowserSession(pasted)
            : await capturedBrowserSession();
      } catch (e) {
        // A form post: send the user back to the token field, not a JSON error page.
        const reason =
          e instanceof AppError && e.code === "EXPIRED"
            ? "EXPIRED"
            : "TOKEN_REJECTED";
        return Response.redirect(
          new URL(`/login?reason=${reason}`, appOrigin()),
          303,
        );
      }
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
        username: "fixture.researcher",
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
