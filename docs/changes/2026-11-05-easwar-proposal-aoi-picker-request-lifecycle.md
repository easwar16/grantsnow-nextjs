# Cancel stale approved AOI picker requests

- **Date / author / agent:** 2026-11-05 / easwar / Codex
- **Branch / base commit:** `codex/proposals-azure-integration-20261030` on `118d553`
- **Why:** The VBCS proposals listing opens a live approved AOI picker for outline conversion. Closing and reopening the Next.js picker could allow an older response to replace the current list.
- **What changed:** The picker now passes a cancellation signal to its API request and ignores responses from older requests. Closing it cancels the current request. Files: `src/features/modules/proposals/components/listing.tsx`, `src/lib/api/endpoints/proposals.ts`.
- **Shared pieces used or extended:** Existing `LatestRequest`, `@/lib/api` proposals endpoint, and `ActionDialog`.
- **Replaces / overrides:** None. This builds on the uncommitted AOI picker implementation already in the worktree.
- **Rules touched:** The API layer request path and latest-wins client fetch rule.
- **Checks:** Typecheck passed. Other checks pending.
- **Open:** Live DEV clickthrough and broader proposals parity remain to be verified.
