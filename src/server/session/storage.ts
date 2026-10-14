import "server-only";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { appOrigin, sessionPassword } from "@/server/configuration/environment";
import type { AppSession } from "@/features/auth/types";
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
