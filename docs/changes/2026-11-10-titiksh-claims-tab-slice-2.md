# Claims Unit Claims tab, slice 2: the claim panel, New Claim and Save Claim, claim approvals

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-tab-slice-1.md`)
- **Why:** checklist Next up (Claims tab). Legacy `claims-unit-claims-start-page` (`origin/development`):
  - the drawer: `viewClaimDetails`, `loadClaimLines`, `addNewClaim`, `saveClaim` (`postFundClaims` / `putClaim`,
    then `getFundClaim`), `exportReport` (report-vbcs-claim-lines-listing);
  - the line dialog: `openClaimLineDialog`, `selectHierarchyItem`, `getTransDateValidators`, `addClaimLine`,
    `deleteClaimLine`;
  - rejected lines: `showRejectedLines`, `loadRejectedClaimLines`, `addRejectedClaimLines`;
  - a line's details: `viewClaimableAmounts`, the line menu, `loadAuditTrail` (LINE);
  - approvals: `submitApprovalAction` on CLAIM_HEADER and the line approvals dialog (CLAIM_LINE).

## What changed

- **Claims List:**
  - View opens the claim in the side panel (legacy recordDrawer). The list keeps its place, and a fund change closes
    the panel.
  - Add Claim (`unit-add-claim` edit) opens a new claim.
- **Claim panel** (`record/claim-panel.tsx`):
  - the header fields the claim has (legacy shows each only with a value);
  - Export of the lines (`claims-export`);
  - the lines with Audits (`CLAIM_LINE`), Claimable Amounts and Approvals. Claimable Amounts opens for a position
    line that is not a lump sum, and reuses the activity panel's Position and Claimable sections (`ClaimableSections`).
    Approvals opens once the claim is routed, or once the line is past a user edit;
  - the claim's approval route on the shared workflow (`claim-<fund>-<id>`, CLAIM_HEADER).
- **Claim editor** (`record/claim-editor.tsx`), shown while the claim is open (no route yet, and a status that allows a
  user edit) and the user holds `unit-add-claim` edit:
  - the period;
  - Add New Claim, the line dialog: the legacy cascade, where a pick clears every level below it. A position line
    picks its activity, optional category and person; any other line types its description and company. The dates
    are required with a category, and the transaction date must fall inside the claim period (legacy's messages);
  - Add Rejected Claim (the period's rejected lines, ticked; legacy's "Already Exist");
  - a line's Edit and Delete, kept in the browser until Save Claim, as legacy (Delete removes a line with `unit-add-claim`
    delete);
  - Save Claim, after which the saved claim stays open and the list reads again.
- **Save Claim** (`record/claims.ts` `saveClaim`):
  - Legacy posts every line row as it holds it; here each line is an explicit pick (`linePick`).
  - A line the user may not change is sent as stored.
  - A line that is not the claim's must be one of the fund's rejected lines for the period (it is sent with
    `adj_type_code: REJECT`, as legacy).
  - Every other line is checked against the fund's activity tree, the required fields and the period's dates.
  - A saved line keeps its number.
- **Server reads:** the edit setup (the activity tree from `getActivityCodesHierarchy` as nested options, periods,
  cohorts, the fiscal year and ACADEMIC_YEAR_MONTH) and the rejected lines. Save reuses only the gates, lines, tree and
  period (`editState`), not the labels.
- **Approval host:** `claim-<fund>-<claim>` (CLAIM_HEADER: Submit for a DRFT or REWORK claim with lines whose status
  allows a user edit; Withdraw in AIA) and `line-<fund>-<claim>-<line>` (CLAIM_LINE, view and act). The route's actions
  need `unit-add-claim` edit.
- **Audit:** a line's trail is page `claims-unit-claims-line-<claim>` in the browser (the shared panel's `sec` is a
  number). The host checks the line is on that claim and answers page `claims-unit-claims` with `CLAIM_LINE`.
- **Shared:** `src/shared/claims/claim-period.ts` (`claimPeriodRange`, `monthOf`), used by the dialog and by Save.
- **API layer:** `getFundClaim`, `getClaimLines`, `getActivityCodesHierarchy`, `getRejectedLines`, `postFundClaims`,
  `putClaim` allowlisted; route views `claim`, `edit`, `rejected`; POST `action=save`, and `action=export&claim=1`.

## Shared defect fixed (owner to review)

`ActionDialog`: closing a dialog opened inside another (the claim panel's Claimable Amounts or Approvals) also closed
the outer one. Cause: React passes a nested `<dialog>`'s `close` and `cancel` events to the outer dialog's handlers.
Fix: each dialog acts only on its own events (`e.target === e.currentTarget`). Reproduced and verified live on app
384 claim 1. Recorded in progress.md.

## Legacy defects not carried (recorded)

- Save Claim posted whole rows (any field the browser held); now an explicit pick.
- "Add Rejected Claim" ignored select-all; here each line is ticked (there is no select-all).
- The edit and delete gates passed while the route had not loaded (`?.length !== 0` on undefined); here the server
  reads the route first.

## Live DEV evidence (2026-11-10, app 384 fund 264)

- Claim 1 opened: header, two position lines (Rejected £100, Final Approved £800, with dates and cohort). Claimable
  Amounts showed salary, benefits, purchase service and the claimable tables. Line Approvals showed its route. The
  claim route and history showed. Closing an inner dialog keeps the panel.
- New Claim (October): a Non Position line of £50 (1000 / 300, "Live test supplies", Test Vendor Ltd, 15-Oct-2029),
  Save Claim gave claim 2 (id 874), Pending Submission, £50; the line edited to £60 and saved (putClaim), claim
  £60. Left on DEV: claim 2, not submitted.
- Save took 13 to 40 seconds on DEV while it rebuilt the editor's view. Save now reads only what it needs.

## Not in this slice (next)

Adjustments (the tab, adjustment lines, Save, the adjustment route CLAIM_ADJUSTMENT_HEADER).

## Shared pieces used or extended

`ActionDialog` (fixed), `DataTable`, `Select`, `DateInput`, `InsideField`, `ReadonlyField`, `StatusBadge`, the shared
approval workflow host, the audit drawer, the activity panel's sections (`ClaimableSections`), `claimPeriodRange`.

## Replaces / overrides

Nothing removed.

## Rules touched

None.

## Checks

Typecheck and lint clean; new tests: Save Claim and the period helper (6). Full checks and e2e (new claim panel and
New Claim steps) run when Claims is complete, as agreed.
