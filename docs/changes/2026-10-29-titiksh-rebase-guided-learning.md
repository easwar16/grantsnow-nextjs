# Rebase onto main (Guided Learning, Awards PR), format the guide files, tidy the structure

- **Date / author / agent:** 2026-10-29 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on af86ddf (fast-forward, no conflicts)
- **Why:** routine rebase from `main`; the incoming Guided Learning files failed `prettier --check`; a structure
  review against agent-guide §4 (routes stay thin, module browser code in `src/features/modules/<module>/`).
- **What changed:**
  - Prettier formatting only in `src/features/guides/guide-launcher.tsx`,
    `src/features/guides/modules/awards/index.ts` and `tests/unit/guides.test.ts`. The files are LF, so the failure
    was real drift, not CRLF line endings as the Guided Learning record supposed.
  - Contracts' UI components moved out of its route folders into `src/features/modules/contracts/`, laid out like
    Awards: `listing/` (`contract-filter-form`, `listing-sections`), `new/` (the four field components),
    `record/` (`contract-tabs`, `created-by`, `document-link`, `summary-sections`), and `contracts.module.css`.
    Routes now hold only route files. Imports updated; no code changed.
  - `src/app/(authenticated)/contracts/error.tsx` added, identical to the Awards/Opportunities/Proposals one, so a
    Contracts error keeps the shell instead of falling to the root boundary.
  - Deleted `src/features/modules/opportunities/eoi/object-panels.tsx`: a re-export shim of the shared object
    panels with no importers.
  - e2e (`tests/e2e/workspace.spec.ts`): Guided Learning broke 11 journeys. The Dashboard tour auto-starts and its
    overlay takes the clicks (10), and the Guide menu's `user-menu` class made `.user-menu summary` match two
    elements (1). A file-wide `beforeEach` now marks every registered guide finished (`doneKey`) before each page
    loads; the storage check ignores the `gn-guide:` flags and still requires nothing else in `localStorage`; the
    account-menu selectors use `#user-menu > summary`. No app code changed for this.
- **Shared pieces used or extended:** `State` (error boundary); the guide registry (`guides`, `doneKey`) in e2e.
- **Replaces / overrides:** none. The Contracts move continues §8's move of `src/features/contracts`.
- **Rules touched:** _Keep files formatted with Prettier_; _project structure_ (§4). Guided Learning reviewed
  against the framework: it reuses `AppShell` (optional slot), the user-menu pattern, `Icon`, `idPart`, `gn-btn`
  and the `--gn-*` tokens, and makes no backend calls. Owner decision 2026-10-29: **driver.js is agreed**, and the
  literal guide text stays until the feature is complete; RB keys follow then.
- **Checks:** `tsc --noEmit` clean; lint 0 errors (1 existing `useVirtualizer` warning); `npm test` 76 files /
  831 tests passed (before and after the move); isolated build passed before the move; `npm run test:e2e` and
  the post-move build: see the session report.
- **Open:**
  - Easwar's in-flight Contracts work must rebase onto the moved paths; git follows renames, but edits to the
    old files need re-pointing.
  - Proposals has no `(list)` / `(record)` route groups. Its record route has its own `loading.tsx`, so the
    behaviour matches; left as is.
  - Guide text to the RB once Guided Learning is complete.
