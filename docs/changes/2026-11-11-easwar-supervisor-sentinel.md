# Ethics and Due Diligence supervisor sentinel parsing

- **Date / author / agent:** 2026-11-11 / easwar / Codex
- **Branch / base commit:** `codex/grantsnow-migration-sync-20261105` on `4542021`.
- **Why:** the supervisor operation includes a `Not Applicable` row with `person_id=-1` and no Org Unit. The full fixture browser run showed this row breaking Due Diligence supervisor choices and both modules’ setup edit pages.
- **What changed:** Due Diligence now validates the lookup shape, excludes sentinel or incomplete people, and uses the selectable set for choices and create/edit save checks. Ethics setup edit and update now reuse the same reviewer filtering as Ethics creation. Main files: `src/server/modules/due-diligence/actions.ts`, `src/server/modules/ethics/actions.ts`.
- **Shared pieces used or extended:** existing Oracle API functions and the Ethics reviewer parser; no new layer or dependency.
- **Replaces / overrides:** the prior all-person parser on supervisor responses in these paths; no framework decision changed.
- **Rules touched:** explicit validation of server-read choices; invalid supervisor keys still fail closed.
- **Checks:** TypeScript passed after the fix. The initial full fixture Playwright run had 79 passed, 2 skipped and 4 failed in these paths; all 4 failed journeys passed on the focused rerun after the fix. Before the fix, lint passed with one existing TanStack Virtual warning, 983 unit/integration tests passed, and the isolated production build passed. No live Oracle write was performed.
- **Open:** live Oracle acceptance for both modules remains open, as recorded in their module change records.
