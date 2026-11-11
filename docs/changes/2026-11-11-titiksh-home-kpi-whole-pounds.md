# Home KPI: Submitted Applications Value in whole pounds (legacy 9568)

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021
- **Why:** legacy `origin/development` `042f0c962` (9568, over `cbf06dcc7`): `home-start-page.js` cuts the
  `academic_year_vs_cost` KPI's display string to its whole part (`£1,234.56` → `£1,234`), without rounding.
- **What changed:** `loadKpis` cuts that KPI's string metric the same way; other KPIs and numeric metrics are as they
  were. Files: `src/server/modules/home/kpis.ts`, `src/lib/functions.ts`.
- **Shared pieces used or extended:** new `functions.format.wholeAmount` (legacy's regex).
- **Replaces / overrides:** none.
- **Rules touched:** none.
- **Checks:** Typecheck clean; lint 0 errors (the existing `react-hooks/incompatible-library` warning); `npm test` 109 files / 991 tests; isolated build OK; `npm run test:e2e` 48 passed (2026-11-11). unit test in `tests/unit/date-format.test.ts`. Not seen live yet (DEV fixtures
  return numbers for the other KPIs; the live string comes from `getSharedGetKpiStatistics`).
- **Open:** none.
