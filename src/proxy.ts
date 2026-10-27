import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import {
  appOrigin,
  sessionPassword,
  fixtureMode,
  browserSessionMode,
} from "@/server/platform/configuration/environment";
import type { StoredSession } from "@/server/identity/session/storage";
import { safeReturn } from "@/lib/security";
import { legacyDeepLink } from "@/shared/auth/legacy-link";
export async function proxy(request: NextRequest) {
  // H26: old notification/report emails; the target route authenticates and keeps the deep link through login.
  const legacy = legacyDeepLink(request.nextUrl.search);
  if (legacy) return NextResponse.redirect(new URL(legacy, appOrigin()));
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
export const config = {
  matcher: [
    "/",
    "/home",
    "/proposals/:path*",
    "/awards/:path*",
    "/opportunities/:path*",
    {
      source: "/((?!api/|_next/).*)",
      has: [{ type: "query", key: "page", value: "shell" }],
    },
  ],
};
