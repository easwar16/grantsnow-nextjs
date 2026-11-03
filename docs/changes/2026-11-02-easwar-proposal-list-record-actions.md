# Restore Proposal listing actions from VBCS

- **Date / author / agent:** 2026-11-02 / easwar / Codex
- **Branch / base commit:** current worktree on aec5020
- **Why:** The Proposal listing lacked the VBCS Recycle bin toolbar action and the linked objects, share, clone, and delete actions on each card. Source: `origin/development:webApps/app/flows/proposals/pages/proposals-start-page.html` and its action chains.
- **What changed:** Added the source-gated view and card actions, Recycle bin with restore, linked objects, clone option selection, draft-only delete, and share as document/access entry points. The Next.js routes call the VBCS Oracle operations through the API layer. Server checks enforce module, record, resource, dashboard role, status, parent, report, and recipient boundaries before writes. The role parser retains `delete_access`, which it previously discarded.
- **Shared pieces used or extended:** `Icon`, `ActionDialog`, `LinkedObjectsDialog`, `Select`, `MultiSelect`, `@/lib/api`, `@/server/oracle/api`, and server permission helpers.
- **Replaces / overrides:** Extends `2026-11-02-easwar-proposal-list-actions.md` from toolbar placement to the missing record actions. It does not replace the earlier filter layout change.
- **Rules touched:** Explicit operation allowlist and write payloads, resource visibility, server authorization, stable action IDs, and labelled development fixtures. The legacy checkout was read only.
- **Checks:** Typecheck passed; lint passed with the existing TanStack Virtual warning; 877 unit tests passed; isolated production build passed. Full fixture Playwright suite: 30 passed, 2 skipped. A focused follow-up also passed after adding fixture validation of the share-document write payload. No live DEV mutation was attempted.
- **Open:** The VBCS share access dialog has more options than the existing Next.js Delegation destination. Create Proposal and Create Outline remain disabled until those flows exist; Advanced Query remains a partial drawer.
