import { storage } from "@/server/session/storage";
import {
  fixtureMode,
  browserSessionMode,
} from "@/server/configuration/environment";
import { safeReturn } from "@/lib/security";
const messages: Record<string, string> = {
  EXPIRED: "Your session has expired. Sign in again to continue.",
  UNAUTHENTICATED: "Please sign in to continue.",
  LOGIN_FAILED:
    "Sign-in or GrantsNow session setup failed. Check your account and contact the identity/API administrator.",
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
      <div className="login-brand">
        <span className="brand-mark">G</span>
        <strong>GrantsNow</strong>
      </div>
      <section className="login-card">
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
          <div className="fixture-banner">
            Development fixtures · synthetic data only
          </div>
        )}
        {reason && (
          <p role="status" className="notice">
            {messages[reason] || "Please sign in to continue."}
          </p>
        )}
        {p.idcs === "unavailable" && (
          <p className="notice">
            IDCS sign-out was unavailable. Your identity-provider session may
            still be active.
          </p>
        )}
        {browserSession && (
          <div className="fixture-banner">
            LOCAL DEV — uses your captured GrantsNow browser session
          </div>
        )}
        <form action="/api/auth/login" method="post">
          <input type="hidden" name="returnTo" value={safeReturn(p.returnTo)} />
          <button className="primary" type="submit">
            {fixture
              ? "Enter fixture workspace"
              : browserSession
                ? "Open connected DEV workspace"
                : "Continue with Oracle IDCS"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <small>
          {fixture
            ? "No Oracle connection is made in this mode."
            : browserSession
              ? "The protected server validates your captured DEV token. No local IDCS login is attempted."
              : "Use your existing institutional account."}
        </small>
      </section>
    </main>
  );
}
