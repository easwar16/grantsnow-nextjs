# One function per backend operation, app-wide; record state dropped after status writes

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021 (after `2026-11-11-titiksh-finalize-roles-shared-locks.md`)
- **Why:** owner, 2026-11-11: "fix those backend calls" (guide §5 "one function per backend operation, app-wide";
  18 operations were defined more than once) and "check if this tab appearing and disappearing issue can happen on
  other modules as well".
- **What changed:**
  - **Record state after status writes.** The held reads that carry a record's rights or status are listed once
    (`src/server/oracle/api/record-state.ts`: roles, the EOI request, the award). Approval writes, Add Status and the
    page lock write drop all three. Before, approvals and Add Status did not drop the award's details, so an award's
    status, header and tab gates could lag up to 60 s after Submit, a verdict, Withdraw or Add Status (same defect as
    the EOI Workflow tab). Awards' own extra drop after Finalize is gone (the lock write does it). Claims, Contracts and
    Proposals read their status fresh, so they were not affected.
  - **Duplicates merged** (each operation now has one function; callers updated):
    - Ethics and Due Diligence application calls → `applications.ts` (`list`, `setup`, `approvers`, `deleted`,
      `restore`, `save`, `copyOptions`, `copy`, `remove`, by `objectType`), plus `linked` (getApplicationList) for an
      award's due diligence and a proposal's linked applications. `ethics.ts` and `due-diligence.ts` removed.
    - Form definitions → `dynamicForm.forms` with optional `tag` (Ethics / DD form types) and `formRecordId` (staff
      costing); `ethics.form`, `dueDiligence.form`, `dynamicForm.costForms` removed.
    - `lookups.fundingSections({ costModel? })` (was in awards and proposals); `people.contact({ recordType? })` (was
      also `proposals.contactDetails`); `contracts.relationItems({ status? })` (was also `awards.proposals`);
      `proposals.save` (was `proposals.saveSummary` and `opportunities.createProposal`, invalidations merged);
      `roles.record({ objectType: "DASHBOARD" })` with `configuration.dashboardRoleRows` (was
      `configuration.dashboardRoles`); `comments.save({ commentId? })` (was `add` / `update`); `contracts.list({
reference? })` (was also `linkedToProposal`; the legacy object_ref_id clause stays in the API function);
      `notifications.latest({ offset, limit }?)` (was also `page`).
    - Held vs fresh pairs (`dashboardPreferences` / `storedPreferences`, `personStatus` / `storedPersonStatus`):
      one function each; the merge-before-save reads pass `{ fresh: true }`, a new client read option (reads Oracle
      now and replaces the held copy, as reads inside a write already do).
  - `tests/unit/oracle-catalogue.test.ts` now fails on any operation defined twice.
- **Shared pieces used or extended:** the Oracle client (`fresh`), the API layer files above; `docs/api-layer.md`.
- **Replaces / overrides:** the duplicate functions above, several of them in Easwar's modules (Ethics, Due Diligence,
  Proposals, Contracts): only API calls and parameter names changed there, behaviour as before except: Ethics / DD /
  staff-costing form definitions and Proposals' funding sections are now held for the config TTL like every other
  form definition and funding-section read (definitions, not record data).
- **Rules touched:** none; enforces guide §5.
- **Checks:** typecheck clean; lint 0 errors; unit tests 109 files / 992; live DEV reads after a dev-server restart:
  Ethics and DD listings, recycle bins, create setups and tagged form definitions, award create proposals (123),
  award due diligence and projects pages, account panel, Notifications tab; award 1190 Header unlock / Finalize ticks
  update at once. Typecheck clean; lint 0 errors (the existing warning); `npm test` 109 files / 992 tests; isolated build OK; `npm run test:e2e` 48 passed, including the Ethics and Due Diligence journeys (2026-11-11).
- **Note:** unlocking an award's Header also unlocked Budget Periods (backend cascade; legacy sends only the Header's
  lock row).
