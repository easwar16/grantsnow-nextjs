# Local connection through the authenticated DEV browser

The user reports that this IDCS tenant supports cloud development callbacks, not localhost. They explicitly authorized using the existing authenticated Playwright VBCS session's GrantsNow token for local DEV API calls. This is a development bridge, not a verified Next.js IDCS login.

## Current setup

The ignored `.env.local` selects `DEV_BROWSER_SESSION=true`, `FIXTURE_MODE=false`, `APP_ENV=development`, a loopback APP_ORIGIN and the verified DEV ORDS base/apps roots. The app reads `.dev-session/session.json` (ignored, owner-only directory and 0600 file). It contains only token, capture timestamp, backend expiry and the two destinations. Never copy it into source, browser storage, documentation, CI or deployment artifacts.

Click **Open connected DEV workspace** at `/login`. The server validates the captured token with `/session/validate`, maps the returned identity/module access and creates an encrypted HttpOnly session. Browser-supplied usernames cannot establish identity. This mode cannot call `/session/login` to impersonate another user. Protected reads validate again; widgets and records enforce their own module/organization/object scope.

## Refresh an expired capture

1. Select the already authenticated GrantsNow DEV Playwright tab and refresh it. Let VBCS perform its existing login/validation flow.
2. Locate the latest `/session/login` response in Playwright network requests. Save its response body directly to a private temporary file under `.dev-session`; do not print the response. A validate request's `vb-proxy-header-token` is another observed token source, but validation does not reliably provide expiry.
3. Privately parse the response. Reject `response_msg: ERROR`, missing token or a missing/expired unambiguous expiry. Write only `{token,capturedAt,expiresAt,baseUrl,appsUrl}` to the protected capture file. `expiresAt` is epoch milliseconds; use the actual backend expiry, not an invented lifetime.
4. Remove the temporary full response immediately. It contains additional identity data that the local bridge does not need. Never reuse VBCS Authorization headers, cookies or service credentials.
5. Sign in locally again. A local lease lasts at most one hour and never exceeds the captured backend expiry. Renewal validates the token and renews only that bounded local lease.

The current capture is ephemeral and may already be expired when another developer reads this document. An expired/missing capture fails clearly; it never falls back to fixtures.

## Boundaries

This mode is rejected in production, staging, fixture mode or a non-loopback app origin. Captured roots must exactly match configured HTTPS DEV roots and use `/ords/dev_base/` and `/ords/dev/`. Captures require owner-only file permissions, correct ownership, regular-file status and bounded size. Backend token rotation requires a fresh capture. Local sign-out destroys local authority without logging out or extending the shared reference browser's backend/IDCS session.

Production retains independent IDCS code-flow and server-to-ORDS configuration. Build with `DEV_BROWSER_SESSION=false FIXTURE_MODE=false`; production runtime also rejects DEV mode. The private capture is excluded from standalone tracing. No cloud deployment, backend writes, approvals or external workflow handoffs were performed to verify this bridge.
