# Keep Proposal listing actions on one row at desktop width

- **Date / author / agent:** 2026-11-04 / easwar / Codex
- **Branch / base commit:** `codex/proposals-azure-integration-20261030` on `118d553`
- **Why:** A live side-by-side check at 900px showed the Next.js Recycle bin and Advanced Query wrapping below the create actions, while VBCS `origin/development:webApps/app/flows/proposals/pages/proposals-start-page.html` keeps both action groups on one row at that width.
- **What changed:** Tightened only the Proposal listing toolbar's horizontal padding and gaps, and reserved wrapping for phone widths. The source action order and permission gates remain intact.
- **Shared pieces used or extended:** Existing Proposal listing toolbar and `Icon`; no shared component changed.
- **Replaces / overrides:** Refines the spacing in `2026-11-02-easwar-proposal-list-actions.md`; preserves its action placement and `2026-10-30-easwar-listing-filter-alignment.md` filter behavior.
- **Rules touched:** Measured live DEV VBCS layout at the same browser width. No API or record framework change.
- **Checks:** Live read-only side-by-side visual check: all five actions now fit on one row in Next.js at 900px, matching VBCS. Repository checks pending.
- **Open:** This is one verified listing layout correction, not a claim of full Proposal module parity.
