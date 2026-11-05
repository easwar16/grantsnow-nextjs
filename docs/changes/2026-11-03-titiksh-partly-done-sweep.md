# Partly-done sweep: number formatting, Opportunities and header journeys

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c (uncommitted work underneath)
- **Why:** owner order of 2026-11-03: finish what is partly done (Easwar's modules excluded), from `docs/checklist.md`.
- **What changed:**
  - **`functions.format.numberDisplay` (new):** a plain number with at most DECIMAL_PLACES_COUNT || 2 digits.
    `moneyDisplay` without a currency now uses it. It replaces the `Intl` calls in Opportunities Analytics and the
    Home insight chart. Award installments' "today" uses moment instead of `toLocaleDateString`.
  - **Fixtures (labelled, `src/test-support/transport.ts`):** the Shared tab returns two rows, the first with a share
    comment. The finder's deadline warning is on (7 days), and opportunity 3 closes in three days. The share-comments
    button's RB row is visible in fixtures; it is seeded `N`.
  - **e2e:** "Opportunities: Shared tab comments, the deadline warning and a narrow screen" and "header: Help opens
    Tutorials, the bell lists notifications and closes on Escape".
  - **Docs:** the checklist, `home-coverage.md` and `dashboard-parity.md` no longer call the Insights drills and the
    header controls missing: both were built earlier.
- **Found, no code change:**
  - The finder's Advanced filter staying out of the URL matches legacy `manageFilterURL`, which writes six keys only.
  - Legacy Help is one header item (`globalHeadersData`) that navigates to Tutorials, as ours does.
- **Shared pieces used or extended:** `functions.format` (extended).
- **Replaces / overrides:** analytics numbers now show at most 2 decimals (was `Intl` default, 3).
- **Rules touched:** none. `viewerToday` in `src/server/modules/home/service.ts` keeps `Intl.DateTimeFormat`: it
  computes the viewer's calendar day from their zone, it does not format a display value.
- **Checks:** typecheck clean; lint 0 errors; 906 tests; isolated build passed; full e2e 33 passed, 2 skipped, 0 failed.
- **Open:** live comparisons (Insights drills, Analytics, calendar, visual-pass list, chatbot) need a DEV session.
