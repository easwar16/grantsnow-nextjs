# Claims Unit Activities, slice 2b: Add and Edit Activity (goals, position, cost lines)

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-approval-submit-and-fixes.md`)
- **Why:** checklist Next up (Claims, Activities 2b). Legacy `claims-unit-activities` (`origin/development`):
  `addNewActivity`, `editActivity`, `saveActivity`, `selectHierarchyItem`, `salaryParametersChange`,
  `hourlyParametersChange`, `costFieldsChanged`, `costCategoryChanged`, `calculateRateChange`,
  `calculateAmountChange`, `addGoals`, `loadFundActivityTypeCodes`, `loadCategoryConfig`; one drawer form for create,
  view and edit.

## What changed

- **Server** `record/activity-edit.ts`:
  - `activityEditSetup` (`?view=edit`): the fund's activity / function / object codes (getFundActivityTypeCodes,
    with the line's grant category), FTE, pay frequency, salary type and method lookups, active categories
    (getCategoryConfigs), the fund's goals, HOMELESS_FIELD_FLAG, FPCG_MAX_PAY_PERIOD / FPCG_MAX_MONTHLY_PERIOD, RB
    labels, and the version as a draft. Refused without `activity-details` edit, or in a fund (Add) / activity (Edit)
    status whose status config allows no user edit.
  - `saveActivity` (POST `?action=save`): strict input; legacy's required rules by type (position, lump-sum FTE 2,
    hourly / exempt, periods within the max); codes, goals and categories must be the fund's own; the body is
    picked field by field as legacy builds it (object 100 for a position, 200 for Tuition, whole percentages and
    rates, `activity_cost_items`, goals as ids); the salary, benefit and purchase amounts are computed on the server.
    An update keeps the version's reviewer comments, payee and origin. postActivities / putClaimsActivity; then
    legacy's unapplied-balance warning (shared `unappliedWarning`, also Delete's) and `info_message`.
- **Shared** `src/shared/claims/activity-calc.ts`: legacy's formulas in one place for both sides; a Percent of
  Salary line's amount follows the current salary (legacy kept the amount from when the line was added).
- **Browser** `record/activity-editor.tsx`, in the side panel: Add Activity on the fund bar (Activities List, as
  legacy), Edit in the panel when allowed; the codes cascade (a new type clears the codes under it); Homeless when
  the fund asks for it; goals on the searchable `MultiSelect`; the position's details with live totals; benefit and
  purchase-service lines on `DataTable` with an add / edit dialog (category brings its method and rate; Percent of
  Salary takes the rate, Flat Amount the amount). After a save the version opens in view and the list re-reads.
- **API layer:** `postActivities`, `putClaimsActivity`, `getFundActivityTypeCodes`, `getCategoryConfigs` added to the
  allowlist from the legacy catalogue (path placeholders snake_case, as the connection requires), one function each.

## Legacy defects fixed (recorded)

- "At least one goal" missed new activities (`goals` undefined): checked for every save.
- `selectHierarchyItem` compared the function code to 'TUITION': Tuition's object is set from the type.
- Adding goals did not de-duplicate: a multi-select cannot hold a goal twice.

## Live DEV evidence (2026-11-10, app 1065, fund 966 TITLE II, Original Pending)

- Setup read live (4 types, codes, FTE incl. Stipend = 2, periods 13 / 28, categories with whole-percent rates).
- Created a Non Position activity (£1,000), edited it to £1,200, then deleted it (Activities Delete, live).
- Created Position activity 2: Exempt £5,000 at 100%, Social Security 6.2% → £310, benefit 100%: saved £5,310 and
  read back with its percentages and line. Left on DEV (test data); goal 1 added to fund 966 to allow it.

## Shared pieces used or extended

`ActionDialog side`, `DataTable`, `Select`, `MultiSelect`, `InsideField`, `ReadonlyField`, `Figures`, the
activities route, `unappliedWarning`.

## Replaces / overrides

Legacy's goal dialog (a multi-select table) is the searchable `MultiSelect`; cost lines are edited in a dialog, not
inline row edit. Amendment mode (Add in an amendment, Include Activity) is not part of this slice.

## Rules touched

None.

## Checks

Typecheck clean; lint 0 errors (the existing warning); 102 files / 949 tests (new: 7 activity-edit tests); isolated
build passed; Claims e2e 3/3 (new Add Activity steps); full e2e 48 passed, 2 skipped, 0 failed.

## Open

Amendments (slice 3), the Claims tab, approvals (slice 4).
