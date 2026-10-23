import "server-only";
import { cache } from "react";
import { authenticate } from "@/server/identity/session/service";

/** The session identity headers an operation may take; each API function names the ones it sends. */
export type IdentityField = "legal_id" | "org_id" | "user_id";
/**
 * The signed-in user as Oracle calls need it, read once per request from the verified session (never the browser):
 * the token every operation sends, and the identity headers a write declares.
 */
export const oracleContext = cache(async () => {
  const { session, user } = await authenticate();
  return {
    session,
    user,
    token: session.token,
    identity: {
      legal_id: user.legalId ?? "",
      org_id: user.organizationId,
      user_id: user.personId,
    } satisfies Record<IdentityField, string>,
  };
});
export type OracleContext = Awaited<ReturnType<typeof oracleContext>>;
