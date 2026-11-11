# Award Project Costs: trees open to a configured depth (legacy 9305)

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021
- **Why:** legacy `origin/development` `d1d953807` (9305): `resources/js/costingExpand.js` and
  `awards-projects-start-page.js` open the Project Costs tree to `AWARD_PROJECT_COSTS_EXPAND_LEVEL`
  (`1` sections only, `2` sections open to their categories, `3` / unset / anything else everything open). The row
  expanders still open and close any node.
- **What changed:** `projectsView` reads the variable from the held global variables and passes `costsOpenDepth`;
  the Project Costs `DataTable` starts at that depth. Files: `src/server/modules/awards/record/projects.ts`,
  `src/features/modules/awards/record/{project-costs.tsx,projects-types.ts}`.
- **Shared pieces used or extended:** `DataTable` gains `openDepth` (optional; omitted, every row starts open as
  before). Its state now holds the rows the user turned from their starting state instead of the closed ones.
  New `functions.tables.expandDepth` (legacy's level mapping), for Proposals Budget / Pricing when Easwar carries
  `PROPOSAL_COSTING_EXPAND_LEVEL` and `PROPOSAL_PRICING_EXPAND_LEVEL`.
- **Replaces / overrides:** none.
- **Rules touched:** none.
- **Difference from legacy:** legacy rebuilds the tree after each cost save, so it closes again to the configured
  depth; here the rows keep the state the user left them in (same keys). Kept: it is the expander behaviour, not the
  start depth, that the ticket asks for.
- **Checks:** unit tests (`data-table.test.ts`: depth 0 / 1 / all, expander opens a closed row; level mapping);
  typecheck clean. Typecheck clean; lint 0 errors (the existing `react-hooks/incompatible-library` warning); `npm test` 109 files / 991 tests; isolated build OK; `npm run test:e2e` 48 passed (2026-11-11). Live: the variable does not exist on DEV yet (KB: AC1 open), so DEV shows everything open, as
  before.
- **Open:** Proposals Budget / Pricing (Easwar's module).
