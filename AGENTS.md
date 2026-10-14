# GrantsNow foundation conventions

Before project work read the existing context note at `/Users/easwar/Developer/Obsidian Storage/Easwar-Claude/Projects/GrantsNow.md`, concentrating on the Next.js foundation/migration sections and relevant verified business rules. Check current source against historical notes. Update the existing note; never create a duplicate.

The project lives in this repository/worktree. The user's current folder instruction supersedes the original proposed `/Users/easwar/Developer/GrantsNow-Next` destination. Preserve work. Do not initialize nested repositories, commit/push, deploy or provision without separate instruction.

Legacy `/Users/easwar/Developer/GrantsNow` is read-only for this increment. Never change its branches, files, credentials or integrations.

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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

- The user also authorized Opportunities pages and all dashboard tabs/Insights parity. Current source/chart coverage and outstanding write workflows are in docs/dashboard-parity.md and docs/home-coverage.md; do not claim complete VBCS/module parity. Chart dimensions are a strict, authorized personal preference POST; no live mutation check has been run.
- Use `npm run test:e2e` (source-only `.validation` scratch copy) so fixture Next processes do not compete with the user's dev next-env.d.ts. Never copy ignored environment/session credentials into the scratch project. Use GRANTSNOW_BUILD_CHECK=true with fixture/browser modes disabled for an isolated production build check.
