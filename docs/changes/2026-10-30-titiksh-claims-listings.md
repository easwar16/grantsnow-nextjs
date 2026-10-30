# Claims phase 1: Unit Inquiry and Funds Inquiry listings

- **Date / author / agent:** 2026-10-30 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 44cf6bd
- **Why:** owner asked to build Claims (2026-10-30), listings first, 9342 included (it is on `origin/development`).
  Legacy: `flows/claims/pages/claims-unit-inquiry-page*` and `claims-funds-inquiry-page*`.
- **What changed:**
  - `/claims/unit-inquiry`: fund-status list, Unit / Fiscal Year / Fund Type filters (RB-gated), Clear Filters, rows
    with the funds' and claims' status, Create / Update Application (fund table with inline edit, Grant and Payment
    Account per fund, grant auto-select), Clone to another fiscal year with legacy's full-tree part cascade.
  - `/claims/funds-inquiry`: Unit / Fiscal Year / Fund / Function / Object filters, rows, the Summary dialog.
  - The drawer's Claims children link to them; legacy `shell=claims` deep links land on them; `/claims` uses the
    module workspace (no side padding) and is in the proxy matcher.
  - Server: `src/server/modules/claims/{units,funds}.ts`, API routes under `src/app/api/claims/`, nine operations in
    `operations.json` and `src/server/oracle/api/claims.ts`.
- **Shared pieces used or extended:** FilterPanel, StatusList, Select, DateInput, DataTable, ActionDialog,
  Collapsible, RecordMetadata, usePagedApi / useApi, lookups.codes. New: `CloneParts` + `toggleCloneTree`
  (`components/dialog/clone-parts.tsx`), `functions.format.percentDisplay`, `.wide` in `dialog.module.css`,
  `constants.paging.claims` / `claimsScan`.
- **Replaces / overrides:** the Awards clone dialog now renders through `CloneParts` with its own one-level
  `toggleClonePart` (behaviour unchanged, test unchanged). The Claims drawer entries are no longer placeholders.
- **Legacy defects fixed:** Funds Inquiry's Unit filter never loaded (loadOrgUnits never called); the Summary showed
  `spent_percent` undivided (45% read 4,500%); the server refuses removing or changing a submitted fund (legacy
  only disabled the buttons) and checks every chosen value is offered.
- **Kept as legacy:** the row overline is the org unit id; Create sends no required check of its own (the backend's
  FPCG036 names a missing grant); a new fund carries no fund code or name (only an edited one does); Clone reports
  success only when the reply names the new `app_id`.
- **Rules touched:** dashboard_access keys (`create-claims-unit`, `edit-claims-unit`, `claims-clone`) need a role
  row with read, as Awards' `award-clone`; legacy only checked that the row exists.
- **Checks:** typecheck clean; lint 0 errors (existing warning); 851 unit and integration tests; isolated build passed; e2e 21 passed, 2 skipped, 0 failed. Live DEV checks in `docs/progress.md` (2026-10-30).
- **Open:** record pages (phases 2–6), so row titles are not links yet; integration and e2e fixtures for Claims.
  Export landed the same day: `2026-10-30-titiksh-collapsible-and-export.md`.
