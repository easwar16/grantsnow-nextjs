# IDCS sign-in configured; ORDS client-credentials mode

- **Date / author / agent:** 2026-11-04 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `118d553`
- **Why:** owner, 2026-11-04: the IDCS client is registered; sign-in should go through IDCS, tested locally first.
  The Docker build refused to start because `IDCS_COMPATIBILITY_CONFIRMED=false`. Its `IDCS_ISSUER` was also the
  tenant host, but the discovery document advertises `https://identity.oraclecloud.com/`, so every login would have
  failed the issuer check. The server also had no way to authenticate to ORDS the way legacy does.
- **What changed:**
  - `ORDS_AUTH_MODE=oauth`, legacy's mechanism (VB proxy, `services/catalog.json` and
    `services/base/openapi3.json`): OAuth2 client credentials, one client per schema (`ORDS_BASE_CLIENT_ID` /
    `_SECRET`, `ORDS_APPS_CLIENT_ID` / `_SECRET`), token from `<root>oauth/token`.
    `src/server/oracle/service-token.ts` caches the token per schema on `globalThis`, shares one request in
    flight, renews it a minute before expiry and drops it on a 401. `basic` and `bearer` remain.
  - In development, the callback logs why a login failed. The browser still sees only `LOGIN_FAILED`.
  - `.env.example` / `.env.secrets.example` now carry the DEV tenant values, the corrected issuer and the new keys.
    `docs/authentication.md` and `docs/docker-deployment.md` record the checks.
- **Straight to IDCS (owner, same day):** with IDCS on, `/login` submits its own form as soon as it loads
  (`features/modules/account/auto-sign-in.tsx`), as legacy goes straight to IDCS. It stays on the page after
  sign-out, a failed login, a failed backend logout or an unavailable IDCS sign-out, so a failing login cannot
  loop. Fixtures and the paste-token login are unchanged. The login and callback routes now log the real failure
  reason (`[auth] login failed:` / `callback failed:`) in every environment; the browser still gets the generic
  error. Verified in the browser on local dev: `/` went straight to the IDCS authorize page, and
  `/login?reason=LOGIN_FAILED` stayed put.
- **Azure (owner's image, same day):** `/login` loads; "Continue with Oracle IDCS" returns `UPSTREAM` before any
  redirect. The same code and `.env.dev` values redirect correctly locally, so the cause is Azure-side (the Container
  App's environment overriding `IDCS_*`, or no outbound access to IDCS). The reason will show in the log stream
  once an image with the new logging runs.
  (public discovery and JWKS, 2026-11-04):** `code`, S256, RS256, JWKS readable without
  credentials, `client_secret_basic`, `end_session_endpoint`; the only identity claim advertised is `sub`.
- **Shared pieces used or extended:** `oracleSettings`, the Oracle connection's single request path.
- **Replaces / overrides:** none; adds a mode.
- **Rules touched:** the service-trust gate (`ORDS_TRUST_CONFIRMED`) is set by the owner's instruction, for the
  same mechanism legacy trusts.
- **Checks:** typecheck clean; lint 0 errors (the existing warning); 101 files / 936 tests (3 new: shared fetch,
  expiry margin, 401 drop and no cached failure); isolated build passed. **Local, 2026-11-04** (owner wrote the secrets to the local IDCS file, now `.env.dev.local`):
  - start-up validation passes; `/api/health` returns 200;
  - `POST /api/auth/login` loads and validates discovery (issuer accepted) and redirects to the tenant's
    `authorize` with S256;
  - both ORDS clients return tokens (`dev_base`, `dev`: HTTP 200, 3600 s);
  - the IDCS client secret passes client authentication;
  - **IDCS rejects the redirect:** `invalid_redirect_uri` for `http://localhost:3000/api/auth/callback`
    (`127.0.0.1` and `/login` likewise), so the login cannot complete until the URL is registered.

- **Open:** register `http://localhost:3000/api/auth/callback` (redirect) and `http://localhost:3000/login`
  (post-logout) on IDCS client `0dd0c443…`; the same values in `.env.dev` / `.env.dev.secrets` for the Docker
  build.
- **Local IDCS file renamed (owner, same day):** `.env.development.local` → `.env.dev.local`. Next does not load that
  name, and `node --env-file-if-exists` cannot be passed on to Next's worker (`NODE_OPTIONS` refuses it), so
  `npm run dev` / `dev:inspect` now start through `scripts/dev.mjs`. It sets the file's values in the environment
  before Next starts, so they win over `.env.local`. Verified: `/api/health` 200, and login redirects to IDCS. Docker
  ignores the file (`.dockerignore` `.env*`).
- **`.env.example` (owner, same day):** keys only, no values. Its content was handed to the owner to paste, because
  the permission settings deny the agent the file.
- **Sign-out fixed (owner report, same day):** on Azure, sign-out stopped on IDCS's `userlogout` with HTTP 400
  "Invalid logout request". The request was token-free (`client_id` and `post_logout_redirect_uri`), and IDCS does
  not accept that. This **replaces the token-free design** in `docs/authentication.md`, whose tenant check has now
  failed.
  - The callback keeps the ID token in its own sealed cookie, sent only to `/api/auth/logout`, so the 4 KB session
    cookie stays as it was.
  - Logout reads it once and sends `id_token_hint`. Without one, it skips IDCS and lands on `/login` with the IDCS
    notice instead of an IDCS error page.
- **Login page (owner, same day):** on the way to IDCS it shows only "Signing in with Oracle IDCS…" (a `<noscript>`
  button as the fallback), not the card. After a completed sign-out it also goes straight to IDCS, which then asks for
  credentials, as legacy does. A failed login, a failed backend logout or an unavailable IDCS sign-out still show the
  card. Checked locally: `/login` renders the short line, and `/login?reason=LOGIN_FAILED` the card. Typecheck clean;
  lint 0 errors; 936 tests. The Azure sign-out needs the new image.
- **Local sign-in works (same day):** the `invalid_redirect_uri` was not the registration. The local file still held
  the first client id (`0dd0c443…`), while Azure and the owner's configured IDCS application use `f417d453…`. With the
  local file on `f417…` and `APP_ORIGIN=http://localhost:3000`, `http://localhost:3000` went straight through IDCS to
  `/home` without a password, on the IDCS session the browser already had from the Azure instance. The **Open** item
  above is done.
- **Local sign-out verified (same day):** IDCS accepted the `id_token_hint` logout and returned to
  `http://localhost:3000/login`; the next visit asked for credentials. The first attempt, on an IDCS session that
  had started elsewhere (Azure, likely the OCI console too), ended on Oracle's Cloud sign-in page instead. That is
  IDCS ending every application in the shared session, not our request; it was correct on a session started here.
- **Azure released (owner, same day):** the new build went out under the same tag `0.1.0` (revision `--0000003`);
  `/login` shows "Signing in with Oracle IDCS…", and sign-in and sign-out work there. The earlier secret-baked
  build is still in the registry, untagged (`8b2510cb…`, `8d44146a…`), for the owner to delete by digest.
