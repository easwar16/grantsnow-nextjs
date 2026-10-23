import "server-only";
import type { AppSession, UserContext } from "@/shared/auth/types";
import { browserSessionMode } from "@/server/platform/configuration/environment";
import { people } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";

/**
 * The approval actor, legacy `action_by` = `$application.user.username` (the IDCS username): the username verified at
 * OIDC sign-in. A DEV browser session has none (session/validate returns no username), so there it is the email of
 * the person Oracle validated the token for; IDCS usernames are work emails (live VBCS `userName`, 2026-10-23).
 * Anything else, or no such person, is no actor, and every action that names one is refused.
 */
export async function approvalActor(
  session: AppSession,
  user: Pick<UserContext, "personId">,
): Promise<string | null> {
  if (session.username) return session.username;
  if (session.source !== "browser-session" || !browserSessionMode())
    return null;
  try {
    const email = (await people.all())
      .find((p) => String(p.person_id) === user.personId)
      ?.email_address?.trim();
    return email || null;
  } catch (e) {
    if (e instanceof AppError && e.code === "EXPIRED") throw e;
    // The route stays readable; acting on it is refused until the person list can be read.
    return null;
  }
}
