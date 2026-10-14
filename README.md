# GrantsNow Next.js foundation

VBCS parity migration in progress: Home dashboard, card-based Proposal listing, an object-scoped read-only Summary, and initial Opportunity finder and EOI read views, with Oracle IDCS OIDC integration and a separate protected GrantsNow session adapter. Azure is the hosting target; nothing has been provisioned or deployed.

**Project location is this Superset workspace.** The user corrected the original prompt's proposed Developer-directory destination. No nested repository was initialized. The temporary duplicate destination created earlier was removed after moving its files here.

Current dashboard work: all five configured tabs, source-type Insights charts/multi-date filters and geometric skeletons are documented in [dashboard parity](docs/dashboard-parity.md). Opportunity write workflows and exact/full VBCS sign-off remain outstanding.

## Run locally now

Use Node **24 LTS** (the project has `.nvmrc`) and npm. The lockfile pins dependencies.

```sh
nvm use 24
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. This workspace now uses the explicitly authorized connected DEV browser session: `DEV_BROWSER_SESSION=true`, `FIXTURE_MODE=false`. Click **Open connected DEV workspace**. The captured backend token stays in an ignored, protected server-side file; every protected read validates it with Oracle. See [DEV browser session](docs/dev-browser-session.md) for expiry, refresh and security boundaries.

On another checkout, copy `.env.example` to `.env.local`, set `APP_ORIGIN=http://127.0.0.1:3000`, `APP_ENV=development`, `FIXTURE_MODE=true`, and generate a random `SESSION_PASSWORD` of at least 32 characters. Example generation: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Keep the key in the ignored file, never in source control.

## Connect real DEV services

Set `FIXTURE_MODE=false`. Obtain the inputs/actions in [authentication.md](docs/authentication.md) privately from the identity/backend administrators. This includes tenant issuer/client registration, approved username claim, actual session expiry contract and authorized service credentials. Confirm the tenant and service trust gates only after administrator review. VBCS credential references are not secrets and cannot be reused here. No production credentials are needed for fixture development.

Register `APP_ORIGIN/api/auth/callback` and `APP_ORIGIN/login` with IDCS; the application discovers login/token/JWKS/logout endpoints from the actual issuer. Missing runtime settings stop startup clearly. Do not fill placeholders with fabricated real tenant endpoints.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
# Production build: fixture mode must be false (see status/build notes).
DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build
```

Playwright starts a separate dev server on port 3100 with isolated synthetic settings. It does not require live credentials or reuse your port-3000 session. Unit tests mock the server-only boundary for Node tests; production imports retain the real guard.

## Reference patterns

- **Server service:** `src/server/proposals/service.ts` loads initial Server Component data directly and serves the same protected browser refresh handler.
- **Oracle contracts:** allowlisted operation paths/headers in `src/server/api/operations.json`; schemas reject malformed/business-error responses.
- **Client state:** listing URL is backend query state, filter form/expanded toolbar is interaction state, sealed cookie is authentication state. These are separate concerns.
- **Dashboard:** one Suspense/error result per widget, shared permission/scope checks on initial reads and API refresh.
- **UI stack:** semantic HTML controls/tables, React, one CSS token system. No competing state/form/styling libraries. Zod validates boundaries; Vitest and Playwright verify behavior.

Current parity implementation and remaining work: [VBCS progress](docs/vbcs-parity-progress.md). This is not yet exact/full VBCS parity or the complete Proposal module.

Read [architecture](docs/architecture.md), [API mapping](docs/api-mapping.md), [Home coverage](docs/home-coverage.md), [Azure preparation](docs/azure-deployment.md), and [implementation status](docs/implementation-status.md). Full Proposal workflows are approved follow-on work in the parity plan; edit/create/copy/delete/restore and approval mutations are not yet implemented.

## Non-disruptive checks

`npm run test:e2e` runs source-only fixture copies under ignored `.validation/`; it never copies local credentials and leaves the live dev server alone. For a production build check without replacing dev output, use `GRANTSNOW_BUILD_CHECK=true DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build`. The ordinary Azure build/start paths remain `.next`; the check artifact uses `.next-check`.
