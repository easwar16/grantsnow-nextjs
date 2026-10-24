import * as oidc from "openid-client";
import { idcs } from "@/server/identity/auth/oidc";
import {
  appOrigin,
  fixtureMode,
  oidcSettings,
} from "@/server/platform/configuration/environment";
import { storage } from "@/server/identity/session/storage";
import { trustedUsername, safeReturn } from "@/lib/security";
import { oracle } from "@/server/oracle/connection";
import { mapBootstrap } from "@/server/identity/session/contracts";
export async function GET(request: Request) {
  const store = await storage(),
    transaction = store.transaction;
  // No sign-in in progress: a forged or replayed callback must not end the session this browser holds.
  if (!transaction)
    return Response.redirect(
      new URL("/login?reason=LOGIN_FAILED", appOrigin()),
      303,
    );
  // Consume transaction even on a failed callback; no automatic bootstrap retries.
  delete store.transaction;
  await store.save();
  let backendToken: string | undefined;
  try {
    if (fixtureMode() || !transaction || transaction.expiresAt <= Date.now())
      throw new Error("Invalid callback transaction.");
    const current = new URL(`${appOrigin()}/api/auth/callback`);
    current.search = new URL(request.url).search;
    const tokens = await oidc.authorizationCodeGrant(await idcs(), current, {
      pkceCodeVerifier: transaction.verifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (
      !claims ||
      typeof claims.exp !== "number" ||
      claims.exp * 1000 <= Date.now()
    )
      throw new Error("Invalid identity lifetime.");
    const username = trustedUsername(claims, oidcSettings().usernameClaim);
    const b = mapBootstrap(await oracle("getSessionLogin", { username }));
    backendToken = b.token;
    store.app = {
      token: b.token,
      expiresAt: Math.min(b.expiresAt, claims.exp * 1000),
      subject: claims.sub,
      username,
      identityExpiresAt: claims.exp * 1000,
      fixture: false,
    };
    await store.save();
    const destination =
      transaction.returnTo === "/home" &&
      b.user.landing === "PROPOSALS" &&
      b.user.modules.PROPOSALS
        ? "/proposals"
        : safeReturn(transaction.returnTo);
    return Response.redirect(new URL(destination, appOrigin()), 303);
  } catch {
    store.destroy();
    if (backendToken)
      try {
        await oracle("getSessionLogout", { token: backendToken });
      } catch {
        /* Local authority already removed. */
      }
    return Response.redirect(
      new URL("/login?reason=LOGIN_FAILED", appOrigin()),
      303,
    );
  }
}
