# GrantsNow foundation conventions

This is the third GrantsNow UI: the Oracle VBCS app is being replaced, and an Angular rebuild (`GN-Angular`, frozen 2026-10-15) preceded this one. **Read [docs/grantsnow-foundations.md](docs/grantsnow-foundations.md) before project work.** It holds the backend contract, resource-bundle rules, behaviour proven in the Angular build, look-and-feel brief, engineering rules and open conflicts carried from both. Check current source against historical notes.

Context notes, per machine. Read the one that exists, update it in place and never create a duplicate:

- Titiksh: `~/Documents/Projects/Obsidian/GrantsNow/KB-Meta.md` (old-app behaviour, backend contract, RB/RBAC, failure signatures) and `~/Documents/Projects/Obsidian/GN-Rebuild/GN-Rebuild-Meta.md` (rebuild decisions and status). Old-app findings go to the first; build decisions go to the second or to `docs/`.
- Easwar: `/Users/easwar/Developer/Obsidian Storage/Easwar-Claude/Projects/GrantsNow.md` (Next.js foundation/migration sections).

The project lives in this repository. Preserve work. Do not initialize nested repositories, commit/push, deploy or provision without separate instruction. Apply changes and stop; the owner reviews and commits.

The legacy VBCS checkout (`~/Documents/Projects/GrantsNow` or `/Users/easwar/Developer/GrantsNow`) is read-only. Read `origin/development` only. Never change its branches, files, credentials or integrations. GN-Angular (`~/Documents/Projects/GN-Angular`) is reference only: carry its behaviour, not its code.

- Node 24 LTS; App Router, TypeScript; use npm and the lockfile. Check official documentation before adopting APIs. Keep files formatted with Prettier.
- Oracle/session/OIDC modules must import `server-only`. Never pass raw API/session bodies to client components; map an allowlisted display model.
- Use existing OIDC/session libraries. Never implement JWT signing or OAuth validation yourself. Trust only claims returned after library verification. No browser identity/org/person headers.
- All service boundaries enforce session and module/read/organization scope. Proxy/layout navigation is not authorization. Missing grants fail closed.
- Each Oracle operation must exist in the allowlist derived from current source. Check HTTP status and business error envelopes. Requests use `no-store`; no personal data in shared caches.
- Fixtures are explicit, labelled, development-only and contained in `test-support`. No hidden auth bypass route, production fallback or secrets in test artifacts.
- Build accessible native controls with explicit labels, keyboard access and distinct loading/error/empty states. Only implemented routes appear in navigation.
- URL query state is validated and serialized through the feature schema. Do not locally filter a single remote page or equate page rows with API totals.
- Add meaningful failure-mode tests alongside substantial changes; run typecheck, lint, unit/integration tests, production build and relevant Playwright journeys. Record mocks versus live evidence separately.
- The user approved docs/vbcs-parity-implementation-plan.md on 2026-10-14: IDCS, VBCS dashboard/listing fidelity and full Proposal module implementation. Preserve existing backend contracts. Browser access does not authorize live test-data mutations, workflow approvals, ERP handoffs or destructive actions; obtain a designated DEV dataset and side-effect policy for those tests.

## Carried rules (VBCS + GN-Angular; full list in docs/grantsnow-foundations.md)

- The legacy code and the KBs are the source of truth. Prompt packs, `docs/migration/*` and OpenAPI examples are input only; build from the code and real payloads.
- No VBCS concepts (chains, scopes, SDP/ADP, `oj-*`) and no Angular mechanisms in this code. Carry business behaviour and the backend contract only.
- Every write payload is an explicit pick per entity, never a posted view model. Identity, scope and approval actor come from the server session.
- Resource visibility fails closed (`is_visible === 'Y'`). A new field gets a seeded default with `'N'`, a literal fallback, visible and required gates, and More Info for editable fields. Anything promoted to `uat` or higher arrives with `'N'`.
- Every user-triggered write disables its control until the request settles. Never throttle or debounce a save.
- Match the live DEV VBCS app by measurement, not by eye. Add no new dependency until the owner agrees to it.
- Minimal diffs at the true cause. Add state or helpers only when needed. Invent nothing: no new checks, toasts or payload changes without an identified defect. Comments are one line of _why_. Test emptiness explicitly (`0`/`false` are values). Bound every wait. Use try/catch only where something can throw and the catch does something useful.
- Diagnose before editing: get the full stack or a decisive diff before changing code; say what a failed fix rules out.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

- The user also authorized Opportunities pages and all dashboard tabs/Insights parity. Current source/chart coverage and outstanding write workflows are in docs/dashboard-parity.md and docs/home-coverage.md; do not claim complete VBCS/module parity. Chart dimensions are a strict, authorized personal preference POST; no live mutation check has been run.
- Use `npm run test:e2e` (source-only `.validation` scratch copy) so fixture Next processes do not compete with the user's dev next-env.d.ts. Never copy ignored environment/session credentials into the scratch project. Use GRANTSNOW_BUILD_CHECK=true with fixture/browser modes disabled for an isolated production build check.
- User explicitly requested missing VBCS navigation entries on 2026-10-14. These may link to authenticated `/modules/[module]` placeholders stating “Module not available for now”; their display does not confer module permissions or authorize Oracle calls. This supersedes the implemented-only navigation convention for these placeholders.
