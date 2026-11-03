# Contracts merge brought onto the shared framework

- **Date / author / agent:** 2026-10-26 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on d77fd6e (fast-forward to origin/main, then the stashed awards work re-applied)
- **Why:** the Contracts merge forked shared pieces and broke rules (API layer, RB-fail-closed, reuse, layout,
  viewer-zone times); owner asked to bring it in line without breaking it.
- **What changed:** see `docs/progress.md` § "Contracts brought onto the shared layers" and `docs/agent-guide.md`
  §8 (the full list of what was replaced and why). Main files: `src/server/modules/contracts/*`,
  `src/server/oracle/api/contracts.ts`, `src/app/(authenticated)/contracts/**`, `src/server/record/approvals/workflow.ts`,
  `src/features/record/approvals/*`, `src/components/ui/local-time.tsx`, `src/components/ui/select.tsx`.
- **Shared pieces used or extended:** `ApprovalHost`/`ApprovalWorkflow` (graph now lazy for every host), record
  panel `recordHost`, `objectAccessOf`, `statusChoices`, `containsClause`, `ActionDialog`, `DateInput`,
  `StatusBadge`, `CreatorLink`, new `LocalTime`, `Select`/`FormSelect` `busy`.
- **Replaces / overrides:** Easwar's `contractRead` passthrough, read-only Contracts workflow, Kolkata-time
  formatting, hard-coded header/status lists, server actions, native selects/dialogs, duplicate panel services,
  1000px-capped workflow width (agent-guide §8 has each reason).
- **Rules touched:** added the app-wide layout rule (vw/vh, then %) to foundations; added `docs/agent-guide.md`,
  this records folder, and the agent block in `AGENTS.md` / `CLAUDE.md`.
- **Checks:** see `docs/progress.md` (typecheck, lint, 820 tests, build, e2e; live DEV reads of contract 1386,
  award 1183, EOI 4034).
- **Open:** Contracts Summary edit form, New Contract Create on the shared `DynamicForm`, listing date filters
  (Easwar's area); owner decision on `exceljs` and vendored Treant/Raphael.

## In progress at the end of the session: app-wide viewport layout (owner rule, 2026-10-26)

- **Done:** `ActionDialog`'s `width` is now a CSS length string, and every caller compiles. Typecheck, lint and 820
  tests pass on this partial state. Dialogs converted to vw from the legacy JET width class: approvals (50vw),
  comments (50vw), creator card (50vw), history status (50vw), installments (50vw), delegations (41.667vw),
  attachments (60vw), convert (66.667vw), award advanced query (41.667vw), clone (33.333vw), create award (70vw),
  project costs (80vw), project dialog (83.333vw).
- **Verified 2026-10-27:** opportunity comments 36.676vw, award header dialog 28.653vw and project team dialog
  57.307vw are literal px in legacy (`min(640px, 92vw)`, `style="width: 500px"`, `style="width: 1000px"`), so
  px÷1745 is the rule's translation. Budget (`dialogAwardbudgetEdit`) and Credit (`dialogAwardCreditEdit`) are
  `oj-md-10`: 960px and 1254px became 83.333vw.
- **Dialogs with no legacy width class (measured on live VBCS, 2026-10-27):** Redwood gives every `oj-dialog`
  without a width class a fixed `width: 600px` (min 200px); it does not size them to content. Measured at 1745px:
  `dialogShareOpportunityHome`, `dialogChangeDimension`, `dialogNotes`, `dialogFunderWarning` and the other
  `gn-compact-dialog`s, `dialogSessionExpiry`, all 600px. A first pass with `fit-content` came out at 180–455px on
  DEV (Add Status wrapped its status text), so `ActionDialog`'s `width` is now optional: omitted means 34.384vw
  (600px at 1745px) and at most 70vh tall (owner). Applied to confirm (was 440px), history status (480px),
  contract deadline and share (600px), notes, award links and linked objects (720px) and milestone (784px); the
  idle dialog (420px) and the chart-dimension dialog (420px) get the same 34.384vw.
- **Fixed on the visual pass:** the record drawer's Motion preset animated to a fixed 400px, overriding the CSS;
  it now opens to 30rem.
- **Layout containers converted 2026-10-27 (legacy read on `origin/development`):** notification popup 33.333vw
  (`#popupNotifications` oj-md-4, full width below 768px), finder Advanced filter 40vw with no caps
  (`#popupAdvancedFilter` oj-md-width-2/5), profile dialog 66.667vw (`#dialogManageProfile` oj-md-8), Insights
  year/quarter/month filters 13.754vw (legacy `width:240px`), add-approver field 33.333% (`#cboAddApprovers`
  oj-sm-4), calendar sidebar 12.607vw and side panel 16.046vw (legacy 220px and 280px), idle dialog content-sized
  with the owner caps (`#dialogSessionExpiry` has no width class). The 250px cap on Contracts list facts is gone
  (legacy cells are uncapped). `.createPage dialog` lost its width, which outranked `ActionDialog`'s auto width.
  Dead CSS removed: `.contractFacts`, `.opportunity-information`.
- **Owner decisions 2026-10-27, applied:** drawers stay in rem, as legacy: navigation 20rem, Contracts sidebar and
  the listing skeleton 20rem (the resizable `FilterPanel` starts at 240px, the same 20rem at our 12px root), the
  record drawer 30rem for Comments and Audit alike, configure drawer 26rem within 20–31.25rem. Fixed legacy heights
  become vh at 1043px: expanded Insights chart and attention calendar 47.94vh, attachments tree 28.763vh. The
  approval graph node takes legacy's 250px × 100px minimum (was 272 × 122).
- **Still rebuild-only, no legacy counterpart:** the login card (460px) and the unavailable-module placeholder.
- **Left for the visual pass (markup differs from legacy):** profile status fields (legacy 25%/52%), attachment
  detail pane (oj-md-8) and link form (oj-md-4/6/2), chart dimension dialog (content-sized, 2 columns), the
  approval comment ellipsis cap, Insights chart sizes, skeletons (follow their real elements once those settle).
- **Kept as component details:** toast width, rich-text editor and mention list heights, the funder tree scroll
  height, the 200px card action button and attachment-name ellipsis (legacy px), form field minimums.
- **Visual pass on DEV, 2026-10-27 (1745×1007):** measured as intended: notifications 581.8px, navigation drawer
  240px, configure drawer 312px, profile dialog 1163.6px, Insights filters 240.1px, calendar sidebar 220px,
  attention calendar 482.9px (its month grid now scrolls a little), expanded chart 482.9px, Advanced filter
  698.2px, record drawer 360px, credit and budget dialogs 1454.5px, attachments tree 289.7px, Contracts sidebar
  240px, Add Status 600.2px. Not seen: the approval graph node (award 1176 has no Approvals tab yet). DEV's
  milestone form returned no fields.
- **Checks after the dialog default:** typecheck, lint (the existing warning), 820 unit tests. Full e2e 19 passed, 2
  skipped, 1 failed: the Awards listing journey timed out clicking the drawer's Awards link ("outside of the
  viewport") while a dev server shared the machine; alone it passed 3 of 3 (`--repeat-each 3`). The known
  Awards listing flake, still open.
