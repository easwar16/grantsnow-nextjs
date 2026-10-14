import "server-only";
import { cache } from "react";
import { storage } from "./storage";
import { oracle } from "@/server/api/transport";
import { DEV_SESSION_LEASE_MS } from "./browser-session";
import {
  fixtureMode,
  browserSessionMode,
} from "@/server/configuration/environment";
import { mapBootstrap, mapValidatedIdentity } from "./contracts";
import { AppError } from "@/lib/errors";
import type { AppSession } from "@/features/auth/types";
export function assertActive(session?: AppSession) {
  if (!session)
    throw new AppError("UNAUTHENTICATED", "Sign in to GrantsNow.", 401);
  if (
    session.expiresAt <= Date.now() ||
    session.identityExpiresAt <= Date.now()
  )
    throw new AppError(
      "EXPIRED",
      "Your session has expired. Sign in again.",
      401,
    );
  if (session.fixture !== fixtureMode())
    throw new AppError(
      "UNAUTHENTICATED",
      "This session belongs to a different environment.",
      401,
    );
  if ((session.source === "browser-session") !== browserSessionMode())
    throw new AppError(
      "UNAUTHENTICATED",
      "Session belongs to a different authentication mode.",
      401,
    );
  return session;
}
export const authenticate = cache(async () => {
  const store = await storage(),
    session = assertActive(store.app);
  try {
    if (session.source === "browser-session") {
      const b = mapValidatedIdentity(
        await oracle("getSessionValidate", { token: session.token }),
      );
      if (b.token !== session.token)
        throw new AppError(
          "EXPIRED",
          "The DEV token has changed. Capture it again.",
          401,
        );
      return { session, user: b.user };
    }
    const b = mapBootstrap({
      token: session.token,
      expiry_datetime: new Date(session.expiresAt).toISOString(),
      ...((await oracle("getSessionValidate", {
        token: session.token,
      })) as object),
    });
    if (b.token !== session.token)
      throw new AppError(
        "EXPIRED",
        "Oracle changed your session token. Sign in again.",
        401,
      );
    return {
      session: assertActive({
        ...session,
        expiresAt: Math.min(b.expiresAt, session.identityExpiresAt),
      }),
      user: b.user,
    };
  } catch (e) {
    if (e instanceof AppError && e.code === "BUSINESS")
      throw new AppError(
        "EXPIRED",
        "Oracle could not validate your session. Sign in again.",
        401,
      );
    throw e;
  }
});
export async function renewSession() {
  const auth = await authenticate(),
    store = await storage();
  if (auth.session.source === "browser-session") {
    store.app = {
      ...auth.session,
      expiresAt: Math.min(
        Date.now() + DEV_SESSION_LEASE_MS,
        auth.session.identityExpiresAt,
      ),
    };
    await store.save();
    return store.app.expiresAt;
  }
  const b = mapBootstrap({
    token: auth.session.token,
    ...((await oracle("getSessionExtend_token", {
      token: auth.session.token,
    })) as object),
  });
  store.app = {
    ...auth.session,
    token: b.token,
    expiresAt: Math.min(b.expiresAt, auth.session.identityExpiresAt),
  };
  await store.save();
  return store.app.expiresAt;
}
export async function clearSession() {
  const store = await storage(),
    token = store.app?.token,
    source = store.app?.source;
  // Remove local authority before attempting any external operation.
  store.destroy();
  if (!token || source === "browser-session") return true;
  try {
    await oracle("getSessionLogout", { token });
    return true;
  } catch {
    return false;
  }
}
