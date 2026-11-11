# Claims Unit Claims tab, slice 1: fund bar, Claims Summary, Claims List

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-approvals.md`)
- **Why:** checklist Next up (the unit record's Claims tab). Legacy `claims-unit-claims-start-page` (`origin/development`):
  `initialize`, `loadAppFunds`, `loadLookups`, `loadFundSummary` (`getClaimFigures`), `claimsFilterChanged`,
  `tabSwitched`, `loadClaimsSummary`, `loadClaimsList`, `menuOptionAction` (audits, clone, delete), `cloneClaim`,
  `deleteClaim`, `loadAuditTrail` (HEADER), `exportReport` (report-vbcs-claim-header-listing). The legacy behaviour was
  first written up as a spec (session scratchpad).

## What changed

- **Tab:** Claims joins the unit record between Activities and Attachments (legacy getTabs: path `claims-unit-claims`,
  RB `page-name.unit-claims`, legacy's due-diligence icon), behind its role row as every tab.
- **Fund bar, one shared piece for the record:** the Activities tab's bar moved into `record/fund-bar.tsx` (`FundBar`)
  and `fundBarOf` (server). Each tab passes its own filters, actions and figures. Activities shows the same bar as
  before, and a negative Unapplied Balance still shows red, now through `danger` on the figure.
- **Claims header** (`record/claims.ts` `claimsView`):
  - the fund picker;
  - the category counts (`getFundsCategories` with `object-type=CLAIM`; the API function now takes the object type);
  - the figures: Total Allocation and Approved Amount, then Claimed, Approved Claims, Refunds Approved, Paid and
    Remaining to Claim, each behind its RB row. Remaining to Claim shows red below 0. The figures follow legacy
    getClaimFigures over all the fund's claims; a failed read leaves them empty, as legacy;
  - the claim date and the RB-gated grant fields.
- **Claims Summary:** claimed and available by object code, with totals (a missing amount adds 0).
- **Claims List:** status filter (FPCG_CLAIM_STATUS led by All), columns as legacy, and Export (the `claims-export`
  row, claims on the list).
  - **Row actions:** Audits (the shared audit drawer, page `claims-unit-claims` with the claim as `CLAIM_HEADER`).
  - Clone needs `unit-add-claim` edit and an IA, PAYMENT_IP or PAID claim; it asks first.
  - Delete needs `unit-add-claim` delete and a new claim or one whose status allows a user edit; it asks first.
  - Legacy disabled Clone and Delete when unusable; here they are hidden (owner rule).
- **Server checks:** every write re-reads the fund's claims and refuses a claim that is not the fund's, or a row gate
  that does not pass. The audit scope checks the claim is on one of the application's funds.
- **API layer:** `getFundClaims`, `getClaimsSummary`, `postClaimsClone`, `deleteFundClaims` allowlisted (snake_case
  placeholders). Route `api/claims/units/[id]/claims` (GET header / `view=summary|list`, POST `action=clone|export`,
  DELETE), following `[id]/sign-off/export`.

## Legacy defects not carried (recorded)

- Export showed whenever the `claims-export` row existed (no right named): here it needs that row's read.

## Live DEV evidence (2026-11-10, app 384 fund 264)

- Fund bar: Original Final Approved, £11,000 allocated and approved, Claimed £1,100, Approved Claims £1,000, Refunds
  Approved £200, Paid £0, Remaining to Claim £10,200, claim date 21-May-2026; counts Claim 0 / 0 / 1 / 0.
- Claims Summary: 10 functions with totals; Claims List: claim 1 (Paid with Adjustment), Clone and Delete hidden for
  that status; Export returned the spreadsheet (7 KB, read in memory, not saved); the claim's Audits drawer opens.

## Not in this slice (next)

New Claim and the claim panel (header, lines, the activity picker, claimable amounts), rejected lines, Adjustments,
and the claim / adjustment approvals (the shared workflow host, documents CLAIM_HEADER and CLAIM_ADJUSTMENT_HEADER).
Until then the row's View is not rendered.

## Shared pieces used or extended

`FundBar` / `fundBarOf` (new, shared by the record's two tabs), `DataTable`, `TabBar`, `Select`, `InsideField`,
`StatusBadge dot`, `useConfirm`, the audit drawer (`useRecordAudit`), `reportPayload`, `download` / `saveBlob`.

## Replaces / overrides

The Activities tab's inline fund bar (now `FundBar`, same output).

## Rules touched

None.

## Checks

Typecheck and lint clean; unit tests: Claims tab (5), Activities and record tests pass. Full checks and e2e (new
Claims steps) run when Claims is complete, as agreed.
