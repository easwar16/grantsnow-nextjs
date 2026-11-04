import "server-only";
import { getIronSession, sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import {
  appOrigin,
  sessionPassword,
} from "@/server/platform/configuration/environment";
import type { AppSession } from "@/shared/auth/types";
export interface Transaction {
  verifier: string;
  state: string;
  nonce: string;
  returnTo: string;
  expiresAt: number;
}
export interface StoredSession {
  app: AppSession;
  transaction: Transaction;
  logoutStatus: "SIGNED_OUT" | "BACKEND_LOGOUT_FAILED";
}
const idTokenCookie = () =>
  appOrigin().startsWith("https:")
    ? "__Secure-grantsnow-logout"
    : "grantsnow-logout-local";
/**
 * The sign-in's ID token, which IDCS needs as `id_token_hint` to sign out. It lives in its own sealed cookie, sent only
 * to the logout route, so the session cookie sent with every request stays small.
 */
export async function keepIdToken(idToken: string, ttl: number) {
  (await cookies()).set(
    idTokenCookie(),
    await sealData(idToken, { password: sessionPassword(), ttl }),
    {
      secure: appOrigin().startsWith("https:"),
      httpOnly: true,
      sameSite: "lax",
      path: "/api/auth/logout",
      maxAge: ttl,
    },
  );
}
/** The kept ID token, removed as it is read (a sign-out uses it once). */
export async function takeIdToken() {
  const jar = await cookies(),
    sealed = jar.get(idTokenCookie())?.value;
  jar.delete({ name: idTokenCookie(), path: "/api/auth/logout" });
  if (!sealed) return undefined;
  const token = await unsealData<string>(sealed, {
    password: sessionPassword(),
  }).catch(() => undefined);
  return typeof token === "string" && token ? token : undefined;
}
export async function storage() {
  return getIronSession<StoredSession>(await cookies(), {
    password: sessionPassword(),
    cookieName: appOrigin().startsWith("https:")
      ? "__Host-grantsnow"
      : "grantsnow-local",
    ttl: 8 * 60 * 60,
    cookieOptions: {
      secure: appOrigin().startsWith("https:"),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  });
}
