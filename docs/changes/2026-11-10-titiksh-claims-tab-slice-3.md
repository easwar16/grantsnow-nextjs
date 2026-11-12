# Claims Unit Claims tab, slice 3: Adjustments

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-tab-slice-2.md`)
- **Why:** checklist Next up (Claims tab). Legacy `claims-unit-claims-start-page` (`origin/development`):
  `loadAdjustmentsList`, `addNewAdjustment`, `viewAdjustmentDetails`, `loadAdjustmentLines`, `addClaimLinesToAdj` /
  `addClaimLines`, `addAllLinesToAdj`, `editAdjustmentLine` / `updateAdjustmentLine`, `removeAdjustmentLine`,
  `saveAdjustmentLines` (`postClaimAdjustments` / `putClaimAdjustment`), `deleteAdjustment`, `exportReport`
  (report-vbcs-adjustment-line-listing), `loadAuditTrail` (ADJ_HEADER / ADJ_LINE) and the adjustment approvals
  (CLAIM_ADJUSTMENT_HEADER, line dialog CLAIM_ADJUSTMENT_LINE).

## What changed

- **Where:** legacy's Adjustments tab acts on the claim open in the drawer, and opens only for an approved or paid
  claim (IA, PAYMENT_IP, PAID, PAID_ADJUST, PAY_INELIGIBLE). Here the same content is a section of the claim panel for
  those claims (heading RB `header-labels.claim-adjustments`). The panel already is the claim's context, so a tab
  that needs the drawer open is not repeated.
- **List:** columns as legacy. "Adjustment By" names the person from the directory.
  - View opens the adjustment below the list. Audits opens the shared drawer (`CLAIM_ADJUSTMENT_HEADER`).
  - Delete needs `unit-claim-adjustment` delete and an open status; it asks nothing first, as legacy.
  - Add Adjustment needs the `unit-claim-adjustment` row.
- **Adjustment** (`record/adjustments-section.tsx`):
  - the number, status, Refund Check / ACH Number, Total Refund and Adjustment Comment;
  - Add Claim Line (the claim's lines, ticked) and Add All Claim Lines, each adding a new REJECT line (legacy's
    "Already Exist!");
  - a line's Edit dialog: the type, a RECLASS line's revised function and object (from the fund's codes), a REJECT
    line's refund, the justification. As legacy, it opens with the type cleared, and refuses a reclassification to
    the same codes;
  - a line's Delete (kept until Save);
  - Save and Export;
  - a saved line's Audits (`CLAIM_ADJUSTMENT_LINE`) and Approvals;
  - the adjustment's route on the shared workflow (`adjustment-<fund>-<claim>-<id>`).
- **Save** (`record/adjustments.ts` `saveAdjustment`): legacy's checks and messages, verbatim:
  - "Refund Check Number Missing";
  - "Adjustment Comment Missing";
  - "No Justification" with "Provide justification for Expenditure : …";
  - "No Amount" with "Provide refund amount for Expenditure : …".

  Legacy's explicit pick per line (a RECLASS line sends no refund; a REJECT line no revised codes). Every line must be
  a line of this claim or the adjustment's own; a line the user may not change goes as stored; RECLASS codes must be
  the fund's.

- **Approval host:** `adjustment-…` (Submit for a DRFT or REWORK adjustment with lines whose status allows a user edit;
  Withdraw in AIA) and `adjline-…` (view and act), rights `unit-claim-adjustment` edit.
- **Audit:** page aliases `claims-unit-claims-adj-<claim>` (the adjustment as `sec`) and
  `claims-unit-claims-adjline-<claim>-<adjustment>` (the line), answered as page `claims-unit-claims` with the legacy
  secondary types.
- **API layer:** `getClaimAdjustments`, `postClaimAdjustments`, `getClaimAdjustment`, `putClaimAdjustment`,
  `deleteClaimAdjustment`, `getClaimAdjustmentLines` allowlisted; route views `adjustments` / `adjustment`, POST
  `save-adjustment`, DELETE `action=adjustment`, export with `adjustment=1`.

## Legacy defects not carried (recorded)

- The adjustment form was read-only for a user **with** edit access (inverted gate). Here it is editable with edit
  access while the adjustment is open.
- Add Adjustment and Export showed whenever their role rows existed (no right named): here they need the row's read.
- The adjustment line dialog's "Expenditure Amount" field showed the refund amount; here the line shows both columns
  and the dialog asks only for the refund.

## Live DEV evidence (2026-11-10, app 384, claim 1 = id 442, Paid with Adjustment)

- Read: adjustment 281 (Approved, "Test 11", total refund £200; a RECLASS and a REJECT line), closed to change.
- Created adjustment 604 (REJECT £10 on line 2), then updated it to £12 with a new justification (put). Total refund
  £12. A missing justification was refused with legacy's message. Left on DEV: adjustment 604, Pending, not submitted.

## Shared pieces used

`DataTable`, `ActionDialog`, `Select`, `InsideField`, `ReadonlyField`, `StatusBadge`, the shared approval workflow
host, the audit drawer, `reportPayload` / `download`.

## Replaces / overrides

Nothing.

## Rules touched

None.

## Checks

Typecheck and lint clean; new tests: adjustments (4). Full checks and e2e follow (Claims complete).

## Checks, 2026-11-11

The e2e Claims journey failed at the adjustment line's Type: the fixture had no `FPCG_ADJ_LINE_TYPE` lookup (added
in `src/test-support/claims.ts`, codes `REJECT` / `RECLASS` from the Claims spec). `npm run test:e2e -- -g Claims`:
3 passed. The adjustments render inside the claim panel's `PanelAudit`, so their Audits open above it.
