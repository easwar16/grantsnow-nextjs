# Match Proposal Date Sort and Contracts action placement to VBCS

- **Date / author / agent:** 2026-11-02 / easwar / Codex
- **Branch / base commit:** `codex/proposals-azure-integration-20261030` on `aec5020`
- **Why:** The supplied comparison shows VBCS Proposal Date Sort as one inside-label dropdown with a circular direction icon. Next.js rendered separate Sort by and Direction fields. VBCS Contracts places New Contract immediately after the filter toggle; Next.js pushed it to the far right. A live ascending Creation Date request then returned an Oracle row with `proposal_status_value: null`, which the Next.js parser rejected, hiding the whole listing.
- **What changed:** Proposal listing uses one `Date Sort` `InsideField` and an adjacent direction button, preserving the existing URL sort/direction state. The proposal display mapper accepts a nullable status label and omits the badge when it is absent. Contracts toolbar aligns New Contract beside the filter toggle and uses the VBCS new-application icon. The create route and permission gate are unchanged.
- **Shared pieces used or extended:** Existing `InsideField`, searchable `Select`, and `Icon`; no new component or dependency.
- **Replaces / overrides:** Replaces the two-field Proposal sort layout from `2026-11-02-easwar-proposal-list-actions.md` and adjusts the Contracts toolbar placement from the listing implementation. The VBCS source uses `sortOrderChange.js` to flip direction and refresh only when an attribute is selected; Next.js retains that behavior through its URL query.
- **Rules touched:** Source-measured listing appearance, accessible controls, existing query schema, and Oracle response mapping. No request or write payload change.
- **Checks:** Typecheck and lint passed (one existing TanStack warning); 883 unit/integration tests passed, including a nullable-status sorted page regression; isolated production build passed. Full fixture E2E suite: 30 passed, 2 skipped. With a live DEV browser session, ascending and descending Creation Date each loaded 10 of 1338 proposals.
- **Open:** Full visual comparison remains to be checked across other sort choices.
