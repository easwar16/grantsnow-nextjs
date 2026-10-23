import { storage } from "@/server/identity/session/storage";
import {
  fixtureMode,
  browserSessionMode,
} from "@/server/platform/configuration/environment";
import { safeReturn } from "@/lib/security";
import { Icon } from "@/components/ui/icon";
const messages: Record<string, string> = {
  EXPIRED: "Your session has expired. Sign in again to continue.",
  UNAUTHENTICATED: "Please sign in to continue.",
  LOGIN_FAILED:
    "Sign-in or GrantsNow session setup failed. Check your account and contact the identity/API administrator.",
  TOKEN_REJECTED:
    "That session token was not accepted. Copy the current token from the signed-in GrantsNow DEV app and try again.",
  SIGNED_OUT: "You have signed out of GrantsNow.",
  BACKEND_LOGOUT_FAILED:
    "Local sign-out is complete. Oracle session cleanup failed; the backend session must expire or be revoked by an administrator.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams,
    fixture = fixtureMode(),
    browserSession = browserSessionMode(),
    reason = p.reason || (await storage()).logoutStatus;
  return (
    <main id="main" className="login-page">
      <div id="login-brand" className="login-brand">
        <span className="brand-mark">G</span>
        <strong>GrantsNow</strong>
      </div>
      <section id="login-card" className="login-card">
        <div className="eyebrow">RESEARCH ADMINISTRATION</div>
        <h1>
          Your research.
          <br />A clearer workspace.
        </h1>
        <p>
          Access proposals, upcoming deadlines and the decisions that need your
          attention.
        </p>
        {fixture && (
          <div id="login-fixture-banner" className="fixture-banner">
            Development fixtures · synthetic data only
          </div>
        )}
        {reason && (
          <p id="login-notice" role="status" className="notice">
            {messages[reason] || "Please sign in to continue."}
          </p>
        )}
        {p.idcs === "unavailable" && (
          <p id="login-idcs-notice" className="notice">
            IDCS sign-out was unavailable. Your identity-provider session may
            still be active.
          </p>
        )}
        {browserSession && (
          <div id="login-browser-session-banner" className="fixture-banner">
            LOCAL DEV — connects with your GrantsNow DEV session token
          </div>
        )}
        <form id="login-form" action="/api/auth/login" method="post">
          <input
            id="login-return-to"
            type="hidden"
            name="returnTo"
            value={safeReturn(p.returnTo)}
          />
          {browserSession && (
            <label className="token-field">
              GrantsNow session token
              <textarea
                id="login-token"
                name="token"
                rows={3}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="token-hint"
              />
              <small id="token-hint">
                Paste the whole <code>token</code> cookie from the signed-in
                GrantsNow DEV app, so its expiry comes with it. Leave blank to
                use the captured session file.
              </small>
            </label>
          )}
          <button id="login-submit" className="primary" type="submit">
            {fixture
              ? "Enter fixture workspace"
              : browserSession
                ? "Open connected DEV workspace"
                : "Continue with Oracle IDCS"}{" "}
            <Icon name="arrow-right" />
          </button>
        </form>
        <small>
          {fixture
            ? "No Oracle connection is made in this mode."
            : browserSession
              ? "The server validates the token with GrantsNow and keeps it server-side. No local IDCS login is attempted."
              : "Use your existing institutional account."}
        </small>
      </section>
    </main>
  );
}
