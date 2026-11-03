# GrantsNow Next.js foundation

VBCS parity migration in progress: Home dashboard, card-based Proposal listing, an object-scoped read-only Summary, and initial Opportunity finder and EOI read views, with Oracle IDCS OIDC integration and a separate protected GrantsNow session adapter. Azure is the hosting target; nothing has been provisioned or deployed.

This is the standalone Next.js project for the GrantsNow UI rebuild. It uses the existing Oracle services and IDCS integration; it does not modify the legacy VBCS application.

Current dashboard work: all five configured tabs, source-type Insights charts/multi-date filters and geometric skeletons are documented in [dashboard parity](docs/dashboard-parity.md). Opportunity write workflows and exact/full VBCS sign-off remain outstanding.

## Docs

| Read                                                                                                                                                                   | For                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md) and [foundations](docs/grantsnow-foundations.md)                                                                                                | the rules: backend contract, resource bundles, engineering rules, decisions              |
| [architecture](docs/architecture.md)                                                                                                                                   | the project structure, layering rules and runtime design                                 |
| [API layer](docs/api-layer.md)                                                                                                                                         | how every backend call is made: Oracle and OIC functions, caching, paging, browser hooks |
| [progress](docs/progress.md)                                                                                                                                           | where the rebuild stands, the approved plan and history                                  |
| [authentication](docs/authentication.md), [DEV browser session](docs/dev-browser-session.md)                                                                           | IDCS sign-in and the local DEV token bridge                                              |
| [API mapping](docs/api-mapping.md), [Home coverage](docs/home-coverage.md), [dashboard parity](docs/dashboard-parity.md), [account settings](docs/account-settings.md) | per-area contracts and parity notes                                                      |
| [security review](docs/security-review.md), [Azure deployment](docs/azure-deployment.md)                                                                               | security and hosting                                                                     |

Generated from the legacy repo (read-only): `node scripts/oracle-catalogue.mjs --write` produces the Oracle and OIC API catalogues, and `node scripts/resource-seed.mjs` produces the fallback translations (`--check` verifies it).

## Run locally now

Use Node **24 LTS** (the `engines` range in package.json) and npm. The lockfile pins dependencies.

```sh
nvm use 24
npm ci
npm run dev
```

Open <http://localhost:3000> (the exact `APP_ORIGIN`: sign-in/out check it and the session cookie is host-only). This workspace uses the explicitly authorized connected DEV session: `DEV_BROWSER_SESSION=true`, `FIXTURE_MODE=false`. Paste your GrantsNow `token` cookie and click **Open connected DEV workspace**; the token stays server-side and every protected read validates it with Oracle. See [DEV browser session](docs/dev-browser-session.md) for expiry, refresh and security boundaries.

On another checkout:

1. `cp .env.example .env.local`. The example already points at the GrantsNow DEV environment (ORDS, OIC, APEX tools, chatbot) and uses the paste-token login.
2. Set `SESSION_PASSWORD` to a random key of at least 32 characters: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
3. Optional, for EOI file upload/download: get `GN_OIC_USER` / `GN_OIC_PASSWORD` privately from the team lead. Without them file storage shows as not connected and everything else works.
4. `npm ci && npm run dev`, open <http://localhost:3000>, and paste your GrantsNow `token` cookie (from the signed-in VBCS app) on the login page.

`.env.local` stays git-ignored: it holds the session key and the OIC credentials, which must never reach source control. For offline work without DEV, set `FIXTURE_MODE=true` and `DEV_BROWSER_SESSION=false`.

## Connect real DEV services

Set `FIXTURE_MODE=false`. Obtain the inputs/actions in [authentication.md](docs/authentication.md) privately from the identity/backend administrators. This includes tenant issuer/client registration, approved username claim, actual session expiry contract and authorized service credentials. Confirm the tenant and service trust gates only after administrator review. VBCS credential references are not secrets and cannot be reused here. No production credentials are needed for fixture development.

Register `APP_ORIGIN/api/auth/callback` and `APP_ORIGIN/login` with IDCS; the application discovers login/token/JWKS/logout endpoints from the actual issuer. Missing runtime settings stop startup clearly. Do not fill placeholders with fabricated real tenant endpoints.

## Seeing the Oracle calls while debugging

The browser never calls Oracle. Pages are rendered on the server, and client components call this app's own `/api/*` routes. So Chrome's Network tab shows only those routes and the page's RSC requests (`?_rsc=`). The ORDS and OIC calls run in Node, where the session token stays, and they never reach the browser.

To watch them:

1. Run `npm run dev:inspect` instead of `npm run dev`.
2. Open `chrome://inspect` in Chrome and choose **Open dedicated DevTools for Node**.
3. That window's **Network** tab lists every Oracle and OIC request the server makes, with its status and timing. **Sources** lets you set breakpoints in `src/server/**`.

The terminal also prints `[oracle] <operation>` for every call that fails or takes over a second.

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

## Clearing local build and test output

Git-ignored output accumulates locally: e2e scratch copies, the build-check output and Playwright results. Clear it any time with:

```sh
npm run clean -- --dry-run   # list what would go and its size, delete nothing
npm run clean                # .validation, .next-check, test-results, playwright-report, tsconfig.tsbuildinfo
npm run clean -- --dev       # also the dev build cache (.next); skipped while `npm run dev` is running
npm run clean -- --deps      # also node_modules; restore with `npm ci`
```

It never touches source, docs, `.env*` files or git. `npm run test:e2e` now removes its own scratch copy after each run; set `GRANTSNOW_KEEP_E2E=1` to keep one for debugging.

## Reference patterns

- **Server service:** `src/server/modules/proposals/service.ts` loads initial Server Component data directly and serves the same protected browser refresh handler.
- **Oracle contracts:** allowlisted operation paths/headers in `src/server/oracle/operations.json`; schemas reject malformed/business-error responses.
- **Client state:** listing URL is backend query state, filter form/expanded toolbar is interaction state, sealed cookie is authentication state. These are separate concerns.
- **Dashboard:** one Suspense/error result per widget, shared permission/scope checks on initial reads and API refresh.
- **UI stack:** semantic HTML controls/tables, React, one CSS token system. No competing state/form/styling libraries. Zod validates boundaries; Vitest and Playwright verify behavior.

Current parity implementation and remaining work: [progress](docs/progress.md). This is not yet exact/full VBCS parity or the complete Proposal module.

Read [architecture](docs/architecture.md), [API mapping](docs/api-mapping.md), [Home coverage](docs/home-coverage.md), [Azure preparation](docs/azure-deployment.md), and [progress and history](docs/progress.md). Full Proposal workflows are approved follow-on work in the parity plan; edit/create/copy/delete/restore and approval mutations are not yet implemented.

## Non-disruptive checks

`npm run test:e2e` runs source-only fixture copies under ignored `.validation/`; it never copies local credentials and leaves the live dev server alone. For a production build check without replacing dev output, use `GRANTSNOW_BUILD_CHECK=true DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build`. The ordinary Azure build/start paths remain `.next`; the check artifact uses `.next-check`.
