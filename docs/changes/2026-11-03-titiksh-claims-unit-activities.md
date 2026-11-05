# Claims Unit record: Activities tab, slice 1

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code
- **Branch / base commit:** 9305 on d972979 (uncommitted work underneath)
- **Why:** owner: "complete rest of the claims module". Legacy `claims-unit-activities-start-page` (spec in the KB,
  `GrantsNow-Claims-Activities-Spec.md` §1.1–§1.4, §2.1, §2.4 delete, §3, §4.5).
- **What changed:**
  - **Tab:** `activities` joins `unitTabs` (legacy `claims-unit-activities`, read access opens it).
  - **Header** (`record/activities.ts` `activitiesView`): the fund picker (first fund unless one is chosen), the
    `FPCG_ACTIVITY_PERIOD` period, and the read-only fund status (`FPCG_FUND_STATUS` name), Total Allocation,
    Activity Amount, Unapplied Balance and Approved Amount from `getFundsCategories`; the categories table beside
    them.
  - **Fund Summary** (`?view=fund-summary`): `getActivitySummary` for the period, with column totals summed as
    legacy does (a missing amount adds 0).
  - **Activities List** (`?view=list`): the `FPCG_ACTIVITY_STATUS` filter (legacy's leading "All" = `""`), the
    table with its Total, and Delete.
  - **Delete:** server-checked. The version must be on the fund, `activity-details` delete is needed, and
    `CLAIM_ACTIVITY` must allow the row's status. Legacy's no-confirmation delete is kept. Afterwards the server
    compares the unapplied balance before and after, and answers legacy's `unapplied-summary` / `-message` warning
    when it turned negative.
  - **Slice 2a, View** (`record/activity.ts`, `record/activity-details.tsx`): a list row's View opens the
    Activity Details tab, which shows only while an activity is open (legacy's tab, disabled without edit, is
    reached through View anyway; hidden-not-disabled).
    - **Header:** the number, the version (switching it reads that version), Mark as active (legacy
      `btnMarkAsActive` rules, checked again on the server), the fund, the status, and Homeless when the fund's
      `HOMELESS_FIELD_FLAG` preference is on. The goals sit beside it.
    - **Sub-tabs, shown only when legacy enables them:** General Details, Position Details (pay, salary, and the
      benefit and purchased-service lines with totals), Claimable Amount, Amendment History (position or general
      amount columns) and Claim Details. The last three are each read when opened.
    - Percentages are held as fractions (÷100 on read), as legacy does.
    - Every read checks that the activity version is on one of the application's funds.
  - **Not yet (later slices):** Add / Edit activity (2b), Amendments, roster and equipment
    accordions, the requirement forms, and the CLAIM_FUNDS approvals with Submit / Withdraw.
- **Shared pieces used or extended:** `TabBar`, `DataTable` (footers, row actions), `Select`, `InsideField`,
  `ReadonlyField`, `useApi`, `useInFlight`, `useToast`, `functions.format.moneyDisplay`; Goals' `appFundsOf` /
  `fundOf` / `items` / `header` (now exported); `statusConfig` / `available`.
- **Oracle:** `claims.fundCategories`, `activitySummary`, `activities`, `deleteActivity` (`getFundsCategories`,
  `getActivitySummary`, `getActivities`, `deleteClaimsActivity` in `operations.json`); `activity`, `activityVersions`,
  `setActiveVersion`, `claimableAmounts`, `amendmentHistory`, `claimDetails` (`getClaimsActivity`,
  `getActivityVersions`, `postActivitiesAmendVersions`, `getClaimableAmounts`, `getClaimsAmendmentHistory`,
  `getClaimDetails`).
- **Replaces / overrides:** nothing.
- **Legacy defects not carried:**
  - A Delete outside an editable status is hidden, not disabled (owner rule).
  - Filter changes no longer clear fund preferences or reload everything (spec §9.6).
  - Delete is gated on the server (legacy only gated the button).
- **Rules touched:** hide-not-disable, RB labels with fallbacks, one read per panel.
- **Checks:** tsc 0; eslint 0 on the changed files; vitest 7 new (`tests/unit/claims-unit-activities.test.ts`,
  `claims-unit-activity.test.ts`); e2e "Claims Unit record" passed, with a new Activities journey.
  vitest 920 in all.
- **Live DEV (2026-11-03), unit 1065 and unit 384 (fund 264), against VBCS 621:**
  - Header, categories, Fund Summary and the Activities List match 621 value for value (384: Activity Amount
    £108,150.00, Unapplied Balance -£97,150.00, five activities, Total £108,150.00). 1065's blank Activity Amount,
    Unapplied Balance and Approved Amount are blank in 621 too.
  - Delete shows only on the three pending rows (621 disables it on the two approved ones).
  - View of activity 701 (position): header, goal, General, Position Details (pay period 1–11, Exempt £1,000.00,
    50%, the FLAT_AMOUNT and SALARY_PERCENT lines), Suggested Claimable Amount (11 periods per table), Amendment
    History and Claim Details all read live.
  - Fixed after the comparison: the inner tab bars sit at the start (legacy plain `oj-tab-bar`; `TabBar` gained a
    backwards-compatible `align="start"`); the details header runs down its two columns; Justification shows only
    in an amendment (legacy `amendmentsActive`).
  - Not checked live: Delete (blocked by the agent's permission check; for the owner to run), Mark as active (no
    multi-version activity found), and 621's Position Details screen (the browser extension stopped allowing the
    621 domain mid-check).
  - Open, for 2b: legacy shows the function code as the hierarchy text (`1000 - Instruction`); the view shows
    `Instruction`. It comes with the activity-type hierarchy that 2b's form reads.
