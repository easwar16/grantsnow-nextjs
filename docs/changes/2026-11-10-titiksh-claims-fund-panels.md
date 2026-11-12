# Claims Unit Activities, slice 3b: Roster and Furniture & Equipment

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-amendments.md`)
- **Why:** checklist Next up (Claims slice 3). Legacy `claims-unit-activities-start-page` (`origin/development`):
  `rosterSection` / `furnitureEquipmentSection` above `fundSummaryTable`; chains `expandRoster`, `loadRoster`,
  `openRosterDetails`, `saveRosterItem`, `deleteRosterItem`, `rosterDeleteResponse`, `expandEquipments`,
  `loadEquipmentsList`, `addNewEquipment`, `editEquipment`, `saveEquipment`, `deleteEquipment`.

## What changed

- **Fund Summary sub-tab:** two collapsed panels above the Fund Summary table, headed by the RB `labels.roster` /
  `labels.furniture-equipment` (always shown, as legacy `oj-bind-if test="true"`). Each panel reads when it is first
  opened (`Collapsible` mounts its content on first open), as legacy's expand chains.
- **Roster** (`server/.../record/roster.ts`, `record/fund-panels.tsx`): the members (`getRoster`), Add with
  `activity-roster` edit, a row's Edit / Delete also gated by its `CLAIM_ROSTER` status (legacy `isAvailable`), which
  are hidden rather than disabled (owner rule). The dialog has first and last name, primary fund (required) and its job title
  (`getRosterJobTitles ?app-fund-id=`, required with a fund), the secondary fund and title, and the three flags. Delete asks
  first (legacy `rosterDeleteResponse`). An update keeps the member's credential document ids.
- **Furniture & Equipment** (`record/equipment.ts`): the items (`getEquipments`) with a Purchase Price total; Add,
  Edit and Delete with `activity-equipment` edit (no status gate, no confirm, as legacy). Dialog (50vw, legacy
  `equipmentDetailsDialog`): description, purchase date (`DateInput`), price, serial, location and condition are
  required, as in legacy; funding sources (`MultiSelect`) and comments are optional.
- **Server checks:** every write re-reads the list and refuses an item or member that is not the application's, a
  fund that is not one of its funds, a missing right or a closed roster status. The write bodies are explicit picks.
- **API layer:** `getRoster`, `getRosterJobTitles`, `postRoster`, `putRoster`, `deleteRoster`, `getEquipments`,
  `postEquipment`, `putEquipment`, `deleteEquipment` allowlisted (snake_case placeholders); route views
  `equipment`, `roster`, `roster-titles`; POST `save-equipment`, `save-roster`; DELETE `equipment`, `roster`.
- **Fixtures:** a roster member (Approved, read-only) and an equipment item, with simulated writes; the
  `activity-roster` / `activity-equipment` roles; `CLAIM_ROSTER` status configs.

## Not in this slice

- Credential upload on a roster member (legacy uploads `pri_` / `sec_` files through OIC, which is not connected
  locally); the existing document ids are kept on save.
- `audit-trail-roster` (RB-gated audit button): not built, so not rendered.
- Requirements / surveys (the Fund Summary's second accordion): the next slice.

## Live DEV evidence (2026-11-10, app 384)

- Reads: roster 261 and 262 (Approved, no Edit / Delete), titles Teacher and Admin; equipment 181 "Table", £1,001.00,
  TITLE I.
- Roster: added "Claude Livetest" (TITLE I, Teacher) → member 684, status Under Review (CLAIM_ROSTER allows edit);
  deleted it through the confirm. Legacy shows no toast on success; neither does this.
- Equipment: item 181 saved unchanged (putEquipment) → row unchanged.

## Shared pieces used

`Collapsible`, `DataTable` (footer total, row `actions` with `hidden`), `ActionDialog`, `useConfirm`, `InsideField`,
`Select`, `MultiSelect`, `DateInput`, `StatusBadge dot` + `claimStatusTone`, `functions.format`, `useInFlight`,
`useActionFailure`.

## Replaces / overrides

Nothing.

## Rules touched

None.

## Checks

Typecheck clean; lint 0 errors (the existing warning); 104 files / 959 tests (new: 5 roster and equipment tests);
isolated build passed; full e2e 48 passed, 2 skipped, 0 failed (new Roster and Equipment steps in the Claims Unit
record journey). Host Node 22 (the repo asks for 24).
