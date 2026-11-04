# Live DEV pass against VBCS 621; one dialog frame and one record tab bar app-wide

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c (uncommitted work underneath)
- **Why:**
  - Owner order: finish what was partly done, then re-test what waited on the backend. All of it was checked on DEV
    beside VBCS 621, reads only.
  - **Owner requests (same session):** make the dialog frame one reusable component, and make the record pages' tab
    bar one reusable component, so both look the same in every module.
- **What changed:**
  - **Opportunities Analytics:**
    - DEV's first FUNDING_TYPE row has no label, and the strict schema refused the whole pie ("Statistics
      unavailable"). Legacy draws it as an unnamed slice; so do we now.
    - Both charts are drawn by the shared `InsightChart`, replacing the hand-made CSS bars and pie. Top Funders is one
      series with an RB y-axis title and every funder labelled, turned 90°. The pie shows one-decimal percentages
      inside its slices.
    - Panels measure 818×619 at 1745×799, as 621.
    - The page's UI moved out of the route into `features/modules/opportunities/analytics/` (§4). The page passes
      each chart's pending read, so the two stream in separately. RB texts come from `opportunities-eoi`.
  - **`ChartLayout` (shared, backwards compatible):** `rotateLabels` and `insideLabels`.
  - **Home calendar:** legacy's fixed light palette (`fp-proposals-calendar-styles.css`) replaces the token mapping in
    the light theme; the dark theme keeps the tokens. FullCalendar line heights and the 1.5em toolbar gap are back, and
    the app's 28px control floor no longer applies to its buttons. Every element now measures as on 621 (calendar
    555 vs 556px).
  - **Claims:**
    - The Fund Allocation dialog is 50vw × 75vh, and its first column is plain text, as legacy (873×599 both).
    - A Unit card title with no funds shows "No Funds Assigned!" and stays on the listing (legacy viewClaimInquiry).
  - **Manage profile:**
    - Legacy's three columns: avatar (147px), Full Name / Email / DOB / Gender, then Org Unit / Position and the role
      lists. Each role list is under one label, and System roles has its More Info.
    - Email is legacy `$application.user.username`, through the existing `approvalActor`.
    - Gender is shown in PascalCase, as legacy (lodash `startCase`).
  - **`ActionDialog` (shared, extended):**
    - `help` puts the RB More Info beside the title.
    - `dismissible={false}` has no X, ignores Escape, and reopens if a browser closes it anyway.
    - The four hand-written `<dialog>`s now use it: the expanded Insights chart, the chart Dimension dialog, Manage
      profile and the session-expired dialog. Their duplicate frame CSS is gone.
  - **`RecordTabs` (new, `features/record/shell/record-tabs.tsx`):** the record tab bar, lifted out of `RecordFrame`.
    `RecordFrame` (Awards, EOI, Claims), Contracts' `ContractTabs` and Proposals' `ProposalTabs` all render it. Their
    tab lists, rights and ids are unchanged; their own tab CSS is removed.
- **Found, no code change:**
  - **9412 live:** award 1190 (PI Titiksh) shows Created by Brock Philips, as 621.
  - **Insights drill live:** Proposals by Year, 2026 Closed Funded opens the same 151 proposals as 621.
  - **Funding Opportunity Status:** DEV answers HTTP 555. 621 shows "No data to display" and an "undefined :
    undefined" toast; ours shows the error with Retry.
  - **Backend re-tests:**
    - Linked Objects opens, but takes 70 s.
    - The Awards listing first page still takes 21 s unfiltered.
    - The Awards org-unit lookup now takes 3.1 s (was 52 s).
    - The contract 1386 read took 78 s.
- **Shared pieces used or extended:** `ActionDialog` (extended), `RecordTabs` (new), `InsightChart` and
  `functions.charts` (extended), `HelpButton`, `approvalActor`.
- **Replaces / overrides:**
  - The calendar's token colours in the light theme (the earlier port had mapped legacy's fixed colours to tokens).
  - Proposals' and Contracts' own tab bars (Easwar's modules, at the owner's request): markup and CSS only; their tab
    logic and ids stay.
  - The hand-made analytics charts.
- **Not moved, and why:**
  - **The navigation drawer:** a side drawer, not a dialog.
  - **The chatbot:** a floating window with its own frame and position.
  - **Popovers:** the bell, help, the Advanced filter and the record and configure drawers are not modal dialogs.
- **Rules touched:** none. Analytics now follows §4: the route holds only its page.
- **Checks:** typecheck clean; lint 0 errors; 907 tests; full e2e 32 passed, 2 skipped, 1 failed, then fixed (test
  named the dialog by its old label) and passed alone. Isolated build not re-run while the dev server holds `.next`.
- **Open:**
  - The Analytics legend title ("FundingType") and its hiding of the unnamed slice.
  - The rest of the visual-pass list: the attachments detail pane and link form, the approval comment cap, Insights
    chart sizes, the Dimension dialog's layout.
  - The chatbot against legacy.
