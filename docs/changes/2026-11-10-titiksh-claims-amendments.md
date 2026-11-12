# Claims Unit Activities, slice 3a: Amendments

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-add-edit-activity.md`)
- **Why:** checklist Next up (Claims slice 3). Legacy `claims-unit-activities` › Amendments (`origin/development`):
  `loadAmendmentsList`, `loadAmendmentLines`, `newAmendment`, `viewAmendment`, `initializeIncludeActivity`,
  `includeActivity`, `addAmendmentActivity`, `saveAmendment`, `deleteAmendment`, `deleteAmendmentLine`,
  `navigateBackToAmendment`, `viewAmendmentActivity`.

## What changed

- **Sub-tab:** Amendments shows beside Fund Summary and Activities only for a fund in IA, ADJ_IA, ADJ_AIA, REWORK or
  ADJ_REWORK (legacy disabled it with a tooltip; hidden here, owner rule).
- **Server** `record/amendments.ts`: the list (status filter, FPCG_AMENDMENT_STATUS / _REASON), one amendment's
  lines, the Include picker (getActivities with `amendment-id`, every status), and the writes: include
  (postIncludeAmendActivity, legacy body `{fund_type_id, reason, includeActivities[{activity_id, amend_version_id,
activity_type_code}]}`; the first include mints the amendment), save (putAmendment `{reason}`, refused while a
  line lacks justification or itemization, legacy's message), delete amendment / delete line. Every write checks
  `activity-amendment` edit / delete, an open amendment (status allows a user edit; a new one is open) and that the
  amendment, line and activities are the fund's own; the reason must be a configured one.
- **Activity form in amendment mode** (`activity-edit.ts`): Add Activity from an amendment is gated by the amendment,
  requires Amendment Justification, sends `created_from_amendment: 'Y'`, the reason and the `amendment-id` header, and
  returns the minted amendment; opening a line's activity from the tab shows and requires the justification too.
  After a save the panel returns to the amendment (legacy navigateBackToAmendment).
- **Browser** `record/amendments-panel.tsx`: list with View / Delete (confirm), New Amendment, reason, Include
  Activity dialog (`DataTable` with a tick column), Add Activity (the side-panel form), Save, lines with View / Delete.
- **API layer:** getActivityAmendments, getAmendmentLines, putAmendment, deleteAmendment, deleteAmendmentLine,
  postIncludeAmendActivity allowlisted from the legacy catalogue (snake_case placeholders); `amendment-id` on
  getActivities, as legacy's picker sends it.

## Legacy defects fixed (recorded)

- After New Amendment and the first include / add, legacy left the amendment half-loaded (no status, no Submit) until
  View: the minted amendment is chosen at once.
- Line delete was gated by the line's status: the amendment's status decides, as for the rest of the edit row.
- Line delete left the list's line count and cost difference (and the summary) stale: both read again.
- Deleting the chosen amendment left it chosen: the choice clears.
- Changing the status filter wiped the fund preferences and reloaded unrelated panels: the filter reads only the list.

## Live DEV evidence (2026-11-10, app 384, fund 264 TITLE I, Original Final Approved)

- New Amendment → School Budget Adjustment → included activity 5 → amendment 1 minted (Pending, 1 line).
- Save refused ("Please check Justification/Itemization for Activity: 5"); the line's version edited with a
  justification and £11,000 → line £10,000 → £11,000; Save → "Amendment saved."
- Add Activity in the amendment (Non Position £500, justification) → line 6; line 6 deleted → list back to 1 line.
- Left on DEV (test data): amendment 1 with its line.

## Not in this slice

Submit / Withdraw (approval stages, `post_approval` with doc type CLAIM_FUNDS_AMENDMENT) arrive with the Claims
approvals (slice 4). Roster, Furniture & Equipment and Requirements (Fund Summary panels) are slice 3b.

## Shared pieces used or extended

`DataTable`, `ActionDialog` (incl. `side`), `useConfirm`, `Select`, `InsideField`, `StatusBadge dot`, the activity
form, the activities route.

## Replaces / overrides

Legacy's multi-select table in the Include dialog is a tick column in `DataTable`.

## Rules touched

None.

## Checks

Typecheck clean; lint 0 errors (the existing warning); 103 files / 954 tests (new: 5 amendment tests); isolated
build passed; Claims e2e 3/3 (new Amendments steps); full e2e 48 passed, 2 skipped, 0 failed.
