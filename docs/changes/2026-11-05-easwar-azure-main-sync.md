# Bring migration work onto Azure main

- **Date / author / agent:** 2026-11-05 / easwar / Codex
- **Branch / base commit:** `codex/grantsnow-migration-sync-20261105` from `118d553`, merged `azure/main` at `3841b21`.
- **Why:** the owner requested a pull from Azure, a new branch for the migration changes, then pushes to Azure main and GitHub.
- **What changed:** preserved the Proposal, Ethics and Due Diligence migration while merging the newer IDCS, deployment, Claims and framework changes from Azure. Moved creation and action calls to the current routes, kept the shared Proposal creation Summary, and carried Ethics history and attachments and Due Diligence history into the framework record shells. Completed the fixture responses needed to exercise Staff cost line saving. The browser test scratch copy now includes `scripts/dev.mjs`, which the current `npm run dev` uses.
- **Shared pieces used or extended:** `RecordFrame`, `ActionDialog`, `Select`, the browser API endpoints, Oracle API functions and `test-support` fixtures.
- **Replaces / overrides:** resolved the incoming standalone Proposal creation form in favor of the shared Summary creation flow, as requested by the owner. Combined the incoming Ethics and Due Diligence record shells with the existing history and attachment behavior. No incoming Claims or authentication behavior was discarded.
- **Rules touched:** retained the §4 module layout and `actions/[action]` paths; fixture writes remain development-only.
- **Checks:** typecheck passed; lint passed with one existing TanStack Virtual warning; 101 files and 936 tests passed; isolated production build passed; full fixture browser suite: 48 passed, 2 skipped, 0 failed. No live Oracle write was run.
- **Open:** remaining parity items in `docs/checklist.md`, including Proposal listing native date fields and the full record framework conversion.
