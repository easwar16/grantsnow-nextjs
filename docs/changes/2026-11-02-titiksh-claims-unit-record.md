# Claims Unit Inquiry record: shell and Summary (read)

- **Date / author / agent:** 2026-11-02 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c
- **Why:** the owner's Claims order (listings, Funds record, **Unit record**, activities, claims, approvals). This is
  step 1 of the Unit record: the container and the Summary tab in view mode. Legacy:
  - `claims-unit-inquiry-info-page`: `vbBeforeEnter` (CLAIMS roles), `getTabs`, the `detailsForm` panel;
  - `claims-unit-summary-start-page`: `loadFundSummary`, `loadAppSummary`, `signOffTabSelectionChanged`, and the
    Signed Off and Terms panels.
- **What changed:**
  - **Route:** `/claims/unit-inquiry/[id]/[tab]` on `RecordFrame`.
    - Access: the drawer grant, then the application's own `CLAIMS` roles. Legacy refused no roles or Summary read
      N; a missing Summary row is refused too (fail closed).
    - Panel: Unit (`unit_id - org_unit_name`), Fiscal Year and Program Type, filled down the columns (legacy
      `direction="column"`).
    - The listing's card title opens the record (legacy `divClick` → `viewClaimInquiry`).
  - **Summary tab, in view mode:**
    - **Fund Summary:** legacy `summaryTotals` in the footer (a null adds 0), the grand total under Allocations, and
      the grant period as legacy `getPeriod` (`"~~"` shows " - "). Empty dates show blank (legacy `formatDate`).
    - **Program Preparer and CFO or Controller**, filled down the columns.
    - **Signed Off:** the RB note, the sign-off fields (Network Chief only for a `CONTRACT` unit), and the sign-off
      tabs. Each list is read when its tab opens: stakeholders, meetings, org documents. A document's type shows its
      `FPCG_DOC_TYPE` name.
    - **Terms and Conditions:** the two RB descriptions.
  - **Allowlist and API functions:** `getAppSummary`, `getFundSummary`, `getStakeholders`, `getMeetings` and
    `getDocuments` (`claims.appSummary`, `appFundSummary`, `stakeholders`, `meetings`, `documents`).
    - Legacy's catalogue names the path parameter `{appId}`. The connection only accepts lowercase placeholders, so
      the allowlist uses `{app_id}`; the placeholder never reaches Oracle.
  - **`resourceDescription` (shared):** an entity-encoded description (`&lt;p&gt;…`, as DEV stores the claims
    notes) is decoded before sanitising, as legacy `renderAsHTML` does. Real markup is kept as it is. This fixes
    every More Info and RB note fed escaped text, not only Claims.
  - **`TabBar` (new shared component, `components/ui/tab-bar.tsx`):** an in-page tab bar with arrow-key support,
    used by the sign-off tabs.
- **Shared pieces used or extended:** `RecordFrame`, `DataTable` (footers), `ReadonlyField`, `HelpButton`,
  `useApi` / `endpoint`, `State`, `TableSkeleton`, `DetailSkeleton`, `functions.format`, `objectAccessOf`,
  `recordRoleRows`, `resourceDescription` (extended), `TabBar` (new).
- **Replaces / overrides:** the Unit card title was plain text; it is now the record link.
  - `TabBar` repeats the Awards Projects inner tabs' markup and CSS. Awards Projects, the finder and Home still
    hand-write theirs; moving them onto `TabBar` is left for whoever next works there.
- **Rules touched:** only implemented tabs appear. Goals, Activities, Claims and Attachments join as they are
  built, and the Assurance sign-off tab joins with the Summary writes.
- **Checks:**
  - typecheck clean; lint 0 errors (the existing warning); 92 files / 899 unit and integration tests (5 new in
    `claims-unit-record.test.ts`).
  - e2e: the new Unit record journey and the Unit Inquiry journey pass on fixtures (app 6000; app 6001 has Summary
    read N). Full e2e and the isolated build: see `docs/progress.md`.
  - **Live DEV (reads only), app 1130:** the panel, Fund Summary rows and totals (£28,500.00), Preparer, CFO, Signed
    Off and the three sign-off lists match VBCS 621 for the same application. Nothing was written.
- **Step 2a, Summary Edit / Save (same day):**
  - **Toolbar:** Edit, then Save and Cancel, at the tab's top right (legacy US toolbar).
    - Shown with the record's `unit-summary-edit` **edit** right. Legacy `checkAccess(..., 'unit-summary-edit')`
      names no permission and so passes on any role row, even one with edit N. That is a legacy defect: the rebuild
      fails closed, in the view and on the server.
  - **Edit mode:** inside-label inputs and `DateInput` for the three signature dates. Every shown field is required,
    with JET's "Enter a value." under an empty one. Network Chief appears only for a CONTRACT unit.
  - **Save:** `putAppSummary` (`PUT /claims/app-summary/{app_id}`, a new allowlisted write; the first PUT in the
    allowlist), then the summary is re-read and the tab returns to view mode. Cancel drops the edits.
    - The body is an explicit pick: the row as read now (every known column) with the shown fields replaced. Legacy
      posts its whole `summary` view model.
    - An unchanged date keeps its stored value; a changed one is sent as yyyy-MM-dd.
    - Legacy ignored the reply (a recorded defect); here a failure shows and the page stays in edit mode.
  - **Checks:** typecheck clean; lint 0 errors; 92 files / 901 unit and integration tests (7 in
    `claims-unit-record.test.ts`); the Unit record e2e covers Edit, the required refusal and Cancel on fixtures.
    - **Not yet seen live:** a DEV Save. The browser automation's permission check blocked pressing Save on DEV, so
      it waits for the owner.
- **Open (next steps):**
  - Summary writes: Edit / Save (`putAppSummary`), allocations, stakeholders, meetings, org documents, the
    stakeholder exports, the Assurance form, attachments in meetings and documents, and the Summary audit buttons.
  - Then the Goals tab, Attachments (the shared host), Activities, Claims and approvals.
