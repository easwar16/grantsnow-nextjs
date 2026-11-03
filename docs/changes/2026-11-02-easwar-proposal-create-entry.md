# Proposal listing create entry and save

- **Date / author / agent:** 2026-11-02 / easwar / Codex
- **Branch / base commit:** current worktree on `HEAD` (existing uncommitted work preserved)
- **Why:** VBCS `proposals-start-page.html` exposes enabled Grant App and outline create actions. The Next listing had disabled buttons even when dashboard access granted them. User asked to implement missing migration behavior. The POST payload follows `createProposalActionChain.json` in legacy `origin/development`.
- **What changed:** The listing buttons open an authenticated Grant App form or an outline options dialog and fresh outline form. The create service loads existing Oracle lookups and builds an explicit Proposal payload for `postProposalProposal`. The fixture transport persists created proposals across Next route and page bundles, and Playwright covers the entry and save path.
- **Shared pieces used or extended:** `FormSelect`, `DateInput`, `ActionDialog`, `@/lib/api`, `@/server/oracle/api`, dashboard roles, existing Proposal record route.
- **Replaces / overrides:** Replaces the disabled create controls recorded in `2026-11-02-easwar-proposal-list-actions.md`; user explicitly corrected the premise that VBCS disables creation.
- **Rules touched:** API allowlist operation and server access checks; explicit entity write body; fixture data remains within `test-support`.
- **Checks:** `npm run check` passed (typecheck, 883 unit tests, production build; lint had one pre-existing TanStack Virtual warning). Isolated production build with fixture and DEV browser modes disabled passed. `npm run test:e2e` passed: 32 Chromium journeys, 2 skipped. Targeted creation journeys: 2 passed. `git diff --check` and Prettier check passed.
- **Open:** VBCS outline-from-AOI option and complete create-form flow remain to migrate. No live Oracle write was run.
