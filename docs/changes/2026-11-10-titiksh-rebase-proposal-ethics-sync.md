# Rebase onto origin/main `4542021`; Easwar's Proposal, Ethics and Due Diligence sync brought onto the framework

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh, fast-forwarded from `10e996d` to `origin/main` `4542021`
- **Why:** owner policy (2026-11-04): after a rebase that brings Easwar's code, bring it onto §4/§5 in the same
  session and add Codex steering for what it missed.
- **Rebase:** fast-forward, no conflicts. No rule file changed in the incoming commits (`AGENTS.md`, the guide,
  foundations, `api-layer.md`); 8 new `docs/changes/` records read. The stash re-applied with one conflict,
  `docs/progress.md` (both entries kept). `attachments.ts` merged automatically, both sides kept (9549 size note and
  8483 labels; Easwar's Ethics host); `scripts/run-e2e.mjs` already had main's identical `dev.mjs` line.
- **What changed (onto the framework):**
  - `api/proposals/approved-aoi/` → `actions/[action]` reads `approved-aois` and `approved-aoi-source`; the browser
    endpoints follow. §4 API map.
  - `server/modules/proposals/staff-entry.ts` → `record/staff-entry.ts`; `proposals/new/[type]` →
    `(list)/new/[type]` (same URL). §4.
  - Ethics attachments and comments/audit hosts moved out of the shared `attachments.ts` / `panels.ts` into
    `ethicsAttachmentHost` / `ethicsPanelHost` (`ethics/record.ts`). `AttachmentHost` gains `confidential?: false`,
    replacing `bundle !== "ethics"` in the shared gates.
  - Budget Add Cost buttons: the RB `button-labels` gate is restored, and an action without rights, on a non-editable
    budget or a non-current version is not rendered (it rendered disabled).
  - Budget row menu: Delete and Clone (permanently disabled, empty `run`) removed until built; the e2e journey
    now expects them absent.
  - Ids on 18 staff-entry controls and the approved-AOI Retry button.
  - Codex steering: guide §4 (host registry rule), §5 (RB beats live VBCS; unbuilt actions not rendered), §9 (id
    command's precedence fixed, its false positives named), §12; two lines in `AGENTS.md`.
- **Shared pieces used or extended:** `AttachmentHost` (optional `confidential`), the host registries, the
  `actions/[action]` dispatcher.
- **Replaces / overrides:**
  - `2026-11-05-easwar-proposal-budget-navigation.md`: its choice to show Add Cost buttons whose RB row is `N`
    ("Budget follows the observed source gate"). Overridden by the fail-closed RB rule (same call as `share-comments`).
    If the owner wants legacy's ungated display here, it is one filter clause.
  - Its disabled Delete/Clone menu items (hide-not-disable).
  - `2026-11-05-easwar-ethics-history-attachments.md`: host placement only; behaviour unchanged.
- **Rules touched:** §4 gains the host-registry rule; §5 states the RB-over-live-VBCS precedence already applied.
- **Checks (Node 22.23 on the host: the sandbox has no Node and the host has no Node 24, the repo asks `>=24`):**
  typecheck clean; lint 0 errors (the existing TanStack warning); 101 files / 941 tests passed; isolated build
  passed; e2e (after installing Playwright's Chromium on the owner's go-ahead) 47 passed, 2 skipped, 1 failed:
  `zz-proposal-create` "creates a Grant App". It passes on bare `origin/main` and with some files stashed, but a
  one-file bisect does not hold (the same file both "fixes" and fails it), and failing runs are slower (1.0–1.6 min
  against 47 s). The failing trace shows a dev Fast Refresh mid-test and the dynamic form read twice; Create then
  sends nothing, because `proposal-edit-form.tsx` returns silently on `!formReady || !formRef.current.check(true)`.
  Timing-dependent in the fixture dev server, and a real gap: Create can do nothing with no message.
  No live DEV check.
- **Open:**
  - The staff entry page (guide §12, last paragraph): RB labels, `ReadonlyField`, dates through `functions.format`,
    the staff search on `Select`, gates on its Add New Cost links, the invented First Increment range. A near-rewrite
    of a page Easwar is still building: owner's call whether we do it or Easwar does.
  - Still §10 debt in Proposals: `components/`, the listing's hand-built `role="tablist"` and two native date inputs,
    20 flat server files, the record shell not on `RecordFrame`.
  - `costing-editor.tsx` (14 literal labels) and the sponsors editor's disabled PRM priority (a read-only value).
  - `MultiSelect`'s decorative option checkbox has no id (shared component, aria-hidden).
