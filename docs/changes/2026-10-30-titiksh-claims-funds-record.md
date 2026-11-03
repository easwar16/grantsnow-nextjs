# Claims phase 2: the Funds Inquiry record

- **Date / author / agent:** 2026-10-30 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `aec5020` (uncommitted, after the rebase)
- **Why:** owner (2026-10-30): complete Claims Funds Inquiry. Legacy: `flows/claims/pages/claims-funds-inquiry-info-page*`
  and the `claims-funds-{summary,budget,claims,attachments}` flows.
- **What changed:**
  - `/claims/funds-inquiry/[id]/[tab]` on the shared `RecordFrame` (module `record-shell.tsx`, server `record/shell.ts`):
    List, Export, the four tabs (RB `page-name.funds-*`), and the filter bar (Function, Object; Status on Claims only),
    hidden on Summary and Attachments as legacy. No record panel, comments or audit trail: legacy has none.
  - Access (`claims/funds/record.ts`): the drawer grant, then the fund's CLAIM_FUNDS roles; Summary read is required
    (legacy also refused no roles; a missing Summary row is refused too, fail closed). Tabs follow read access.
  - Filters live in the URL (`func`, `object`, `status`, validated by `src/shared/claims/fund-record.ts`) and travel
    with the tab links, as legacy passes them on tab switch; empty means the lookup's first code (legacy default);
    an unoffered code is refused. Status is legacy's synthesised Approved / In Process (`status-type` header).
  - Tabs: Summary (`getAccountSummaries`, the same table and mapping as the listing's dialog: `FundSummaryTable`,
    `record/summary.ts`), Budget (`getActivitiesSummary`), Claims (`getClaimLinesSummary`), Attachments (shared panel,
    host `claim-funds`: CLAIM_FUNDS, the fund id as folder, edit with `claims-funds-attachments` edit access).
  - Export (`record/export.ts`, `POST /api/claims/funds/[id]/export`, a write as every report): the current tab's report
    (`report-vbcs-fund-listing` / `-fund-activity-details` / `-fund-claim-lines`) with the filter bar's values; gated on
    the fund's `claims-export` role.
  - The listing's row title opens the record; legacy deep links with `appFundId` land on it.
- **Legacy defects fixed:** Export on Attachments sent an empty report code and failed: it is not offered there.
- **Shared pieces used or extended:** `RecordFrame`, `DataTable`, `Select`, `AttachmentsTab` / attachments host table,
  `reports.generate`, `fileRoute`, `download`, `reportPayload`, `functions.format`, `DeniedRedirect`, `TableSkeleton`.
- **Replaces / overrides:** the Summary mapping moved from `funds/actions.ts` to `funds/record/summary.ts`; the listing's
  dialog now renders `FundSummaryTable`.
- **Rules touched:** none.
- **Checks:** typecheck clean; lint 0 errors; 891 unit and integration tests (`claims-fund-record.test.ts`: access fail
  closed, tabs, filter defaults and refusals, URL state, deep link). Build and e2e: see `docs/progress.md`.
- **Open:** Claims fixtures for an e2e journey; visual measurement against live VBCS.
