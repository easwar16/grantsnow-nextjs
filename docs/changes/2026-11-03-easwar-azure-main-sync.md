# Restore feature work on current Azure main

- **Date / author / agent:** 2026-11-03 / easwar / Codex
- **Branch / base commit:** `codex/proposals-azure-integration-20261030` on `d972979` (`azure/main`).
- **Why:** The owner asked to preserve all current work, pull Azure, restore the work, and push it on the feature branch.
- **What changed:** Stashed the full working tree, fast-forwarded to Azure main, and reapplied the stash. The overlapping API exports, legacy Ethics and Claims links, fixture write operations, and fixture tests were integrated with the incoming framework changes. The proposal, contract, Ethics, and Due Diligence changes remain as recorded in their individual change records.
- **Shared pieces used or extended:** Kept the generic Oracle connection fixture dispatch; fixture-only operation replies stay in `src/test-support/transport.ts`. Kept all module exports in `src/lib/api/index.ts`.
- **Replaces / overrides:** None of the incoming owner framework changes. Conflict resolutions combine both sides; the shared connection retains its generic operation-free fixture path.
- **Rules touched:** Git preservation and integration, API layer, module route structure, and fixture boundaries.
- **Checks:** `npx tsc --noEmit` passed after stale generated route types were cleared. `npm run lint` passed with one existing React Compiler warning in `src/components/ui/dropdown.ts`. `npm test` passed (93 files, 904 tests). Isolated production build passed. `npm run test:e2e` passed (39 tests, 2 skipped) using isolated fixtures, after the sandbox blocked the first localhost bind. Live DEV writes were not run. The browser suite logged a Select hydration warning and one transient stream error without test failures.
- **Open:** The §9 self-check found native date inputs in the existing Proposal/Contract listing filters, `Intl` use in Proposal list actions, and a Proposal create component inside a route folder. These are separate framework alignment tasks and were not expanded during this Azure sync. Full Ethics/Due Diligence parity and live DEV mutation acceptance remain open in `docs/progress.md`.
