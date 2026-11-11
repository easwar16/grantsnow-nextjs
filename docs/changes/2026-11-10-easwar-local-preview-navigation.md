# Local preview navigation on 127.0.0.1

- **Date / author / agent:** 2026-11-10 / easwar / Codex
- **Branch / base commit:** codex/grantsnow-migration-sync-20261105 on 4542021
- **Why:** the signed-in local preview at `http://127.0.0.1:3000` displayed a hamburger that never opened; other client controls were also inert. The Next.js dev server logged that it blocked requests for `/_next/hmr` from `127.0.0.1` because it started on `localhost`.
- **What changed:** `next.config.ts` now allows the loopback hostname `127.0.0.1` for dev-only resources. The generated `.next` directory was backed up to `/private/tmp/grantsnow-next-cache-20261110-menu` and rebuilt. No shell component behavior changed.
- **Shared pieces used or extended:** existing AppShell and navigation drawer, unchanged.
- **Replaces / overrides:** None. The prior `devIndicators: false` decision remains.
- **Rules touched:** dev-only origin gate; no production origin or authentication change.
- **Checks:** signed-in live Chrome at `127.0.0.1:3000/home` and `/proposals` opens the drawer with its navigation links after restart; VBCS DEV Proposal listing drawer opened for a read-only comparison. Typecheck passed; lint passed with one existing TanStack Virtual warning; 109 unit files / 972 tests passed; isolated production build passed; full fixture Chromium run passed 75 with 2 skipped.
- **Open:** this resolves navigation interactivity, not the remaining Proposal or Funder Rules parity gaps. Live P_6741 list fields and pricing totals/tree match between the two signed-in previews. Both pricing Edit dialogs open; the VBCS dialog has additional institution/rule/unindexed fields and an inline funder table that the current Next.js editor lacks. No Oracle mutation was made.
