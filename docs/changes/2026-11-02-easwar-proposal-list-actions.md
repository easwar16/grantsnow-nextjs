# Place Proposal listing actions like VBCS

- **Date / author / agent:** 2026-11-02 / easwar / Codex
- **Branch / base commit:** current worktree on aec5020
- **Why:** VBCS `proposals-start-page.html` puts the two role-gated create actions beside the filter toggle and Advanced Query at the far right of the listing toolbar. Next.js had no create controls and placed its sort-only Advanced Query block at the bottom of the left filters.
- **What changed:** The listing now shows the source-labelled create actions when `create-proposal` and `create-outline-proposal` dashboard grants exist. They are disabled until the corresponding Next.js creation flow exists, so they cannot lead to a broken route or issue a guessed write. Advanced Query now opens from the right side of the results toolbar, while Date Sort remains in the left filters. The drawer states that the VBCS condition builder is not yet implemented. The fixture grants and browser journey cover the placement and toggle.
- **Shared pieces used or extended:** `FilterPanel`, `Select`, `Icon`, `dashboardRoles`, and resource labels; no shared component changed.
- **Replaces / overrides:** Renames the existing listing's sort-only Advanced Query fieldset to Date Sort in the left filters; keeps the earlier filter-toggle and rows-per-page changes from `2026-10-30-easwar-listing-filter-alignment.md`.
- **Rules touched:** Create visibility uses VBCS dashboard grants. The exact VBCS creation pages and advanced condition builder are not claimed as implemented.
- **Checks:** TypeScript, lint (one pre-existing TanStack warning), 877 unit tests, isolated build, and the existing fixture Playwright suite passed (29 passed, 2 skipped). Focused toolbar journey after fixture-grant update passed.
- **Open:** Build the Next.js create/full outline flows and the VBCS Advanced Query condition builder, then enable the create controls and replace the drawer explanation.
