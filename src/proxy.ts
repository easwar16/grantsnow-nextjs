import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import {
  appOrigin,
  sessionPassword,
  fixtureMode,
  browserSessionMode,
} from "@/server/configuration/environment";
import type { StoredSession } from "@/server/session/storage";
import { safeReturn } from "@/lib/security";
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<StoredSession>(
    nextProxyCookies(request, response),
    {
      password: sessionPassword(),
      cookieName: appOrigin().startsWith("https:")
        ? "__Host-grantsnow"
        : "grantsnow-local",
    },
  );
  const active =
    session.app &&
    session.app.expiresAt > Date.now() &&
    session.app.identityExpiresAt > Date.now() &&
    session.app.fixture === fixtureMode() &&
    (session.app.source === "browser-session") === browserSessionMode();
  if (!active) {
    const url = new URL("/login", appOrigin());
    url.searchParams.set(
      "returnTo",
      safeReturn(request.nextUrl.pathname + request.nextUrl.search),
    );
    url.searchParams.set("reason", session.app ? "EXPIRED" : "UNAUTHENTICATED");
    return NextResponse.redirect(url);
  }
  // Navigation convenience only. Every data service still validates Oracle + permissions.
  return response;
}
export const config = { matcher: ["/home", "/proposals/:path*", "/opportunities/:path*"] };
