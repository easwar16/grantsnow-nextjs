import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { storage } from "./storage";
import { z } from "zod";
import { assertBusiness, oracle } from "@/server/oracle/connection";
import { DEV_SESSION_LEASE_MS } from "./browser-session";
import {
  fixtureMode,
  browserSessionMode,
} from "@/server/platform/configuration/environment";
import { mapBootstrap, mapValidatedIdentity } from "./contracts";
import { AppError } from "@/lib/errors";
import type { AppSession } from "@/shared/auth/types";
const extendedToken = z.object({
  token: z.string().min(1).max(1600).optional(),
  expiry_datetime: z.string().nullish(),
});
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
// D24: validate once per token, not once per request. Home fans out to a dozen widget routes, and DEV's slow
// validate timed out under that load. A minute bounds how long a revoked token keeps working.
const VALIDATE_TTL_MS = 60_000;
const validations = new Map<string, { at: number; body: Promise<unknown> }>();
const validationKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");
/** Sign-out, or a token that must be checked again, drops its shared validation. */
export function forgetValidation(token: string) {
  validations.delete(validationKey(token));
}
function validateOnce(token: string) {
  const key = validationKey(token),
    now = Date.now();
  for (const [k, v] of validations)
    if (now - v.at > VALIDATE_TTL_MS) validations.delete(k);
  const hit = validations.get(key);
  if (hit) return hit.body;
  const body = oracle("getSessionValidate", { token });
  validations.set(key, { at: now, body });
  // A failed validate is not reused: the next request asks Oracle again.
  body.catch(() => validations.delete(key));
  return body;
}
/** The validate body this token shares (profile fields read it too); the same one-minute window as authenticate(). */
export const validatedIdentity = (token: string) => validateOnce(token);
export const authenticate = cache(async () => {
  const store = await storage(),
    session = assertActive(store.app);
  try {
    if (session.source === "browser-session") {
      const b = mapValidatedIdentity(await validateOnce(session.token));
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
      ...((await validateOnce(session.token)) as object),
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
    const b = extendedToken.safeParse(
      assertBusiness(
        await oracle("getSessionExtend_token", { token: auth.session.token }),
      ),
    );
    if (!b.success)
      throw new AppError(
        "CONTRACT",
        "Oracle returned an unusable session token.",
      );
    const backend = Date.parse(b.data.expiry_datetime ?? "");
    store.app = {
      ...auth.session,
      token: b.data.token ?? auth.session.token,
      // D37: a missing or past expiry keeps the current lease, so the client schedules nothing more.
      expiresAt:
        backend > Date.now()
          ? Math.min(
              backend,
              Date.now() + DEV_SESSION_LEASE_MS,
              auth.session.identityExpiresAt,
            )
          : auth.session.expiresAt,
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
  if (token) forgetValidation(token);
  if (!token || source === "browser-session") return true;
  try {
    await oracle("getSessionLogout", { token });
    return true;
  } catch {
    return false;
  }
}
