# Claims listings and Funds record measured against DEV VBCS

- **Date / author / agent:** 2026-10-30 / titiksh / Claude Code
- **Branch / base commit:** Saurabh, on `aec5020` (uncommitted)
- **Why:** owner: check the Claims e2e journeys and the layout against the DEV VBCS app, and make the changes needed.
  Measured VBCS (Funds and Unit listings, fund 641 Summary / Budget / Claims) and ours (fixtures, same 2133×1017
  viewport, a throwaway Playwright spec, deleted).
- **What changed:**
  - **e2e:** two journeys in `tests/e2e/workspace.spec.ts` (Claims Unit Inquiry; Claims Funds Inquiry and its record)
    on a new labelled fixture, `src/test-support/claims.ts` (wired in `transport.ts`; Claims drawer items in
    `fixtures.ts`).
  - **Drawers:** Clear Filters at the drawer's foot as legacy (y969 vs VBCS y970). `FilterPanel`'s panel is now a
    flex column whose body fills it (shared; no change for drawers that don't push to the foot).
  - **Rows:** Funds' View button centred in the row; Unit cards' panels open 14px under the title; the panel headings
    16px tall; fund cells JET's 300px content-box (307px); claim counts 85px fields; Claim Status labels muted
    (`RecordMetadata` gains a `muted` prop, the JET read-only label colour).
  - **Funds record:** the filter bar in an oj-panel (three columns, 13.8px labels, 336px selects); each tab's table in a
    white bordered panel with equal fixed columns, plain first column, money left-aligned as legacy.
  - **`next.config.ts`: `devIndicators: false`.** The dev badge sat over Clear Filters (bottom-left) and, when moved,
    over the listing's Next button (bottom-right); Playwright could not click either. Next still shows compile and
    runtime errors.
- **Replaces / overrides:** nothing recorded; the Collapsible and listing styles are unchanged.
- **Rules touched:** live UI fidelity by measurement; shared pieces extended once (`FilterPanel`, `RecordMetadata`).
- **Checks:** typecheck clean; lint 0 errors (existing warning); 90 files / 891 tests; isolated build passed;
  `npm run test:e2e` 30 passed, 2 skipped.
- **Live follow-up (same day, DEV VBCS against localhost on DEV data):** the Unit card was 44px short. Cause: JET
  collapsible headers are 32px rows (ours 16), the claim fields are JET read-only fields (16px label with 24px right
  padding over a 15px value, 6px to the divider, 9px below, panel body padded 6px), and a Claims-only
  `li.row { padding: 15px 18px }` override (no recorded reason) sat on top of the shared row, which already matches
  VBCS (9/12px margin, 6px padding). Override removed; the number row gets legacy's 6px inset; one `.fields` rule
  serves both listings' metadata; Unit row buttons 15px down (the action slot). Now within 1px: Unit card 238 vs 239,
  fields 92/93/86 vs 92/93/87, buttons y22 both; Funds card 102 both, fields 89/160 at x7/102 both, View y37 both.
  The earlier "85px min-width" was a misreading of label padding and was replaced.
- **Open:** none for these pages; the record header and tabs are the shared `RecordFrame` and were not re-measured.
