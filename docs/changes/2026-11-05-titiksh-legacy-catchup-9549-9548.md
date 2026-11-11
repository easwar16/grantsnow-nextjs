# Legacy catch-up to `2f4d89f39`: attachment size note (9549), Insights year charts (9548)

- **Date / author / agent:** 2026-11-05 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `10e996d`
- **Why:** 33 new `origin/development` commits since `97e90299e`. Two change shared pieces the rebuild owns:
  - 9549 (`object-attachments-fragment.js` `fileSizeNotice`, `FilePickerSelectChain.js`): the "should not exceed"
    note shows the configured `DEFAULT_SIZE_FORMAT` limit, and the oversize warning names the file
    (`<name>: file size should be less than <N>MB`).
  - 9548 (`getProposalGetProposalStatisticsFetch.js`, `getPost_awardsAwardVsCostStatisticsFetch.js`): the two
    year-grouped Insights charts drop years outside the selected Years.
- **What changed:**
  - Attachments: the panel view fills the limit into `fileShouldNotExceed` (`sizeNotice` in
    `features/record/attachments/model.ts`, applied in `server/record/attachments/attachments.ts`); the Add Document
    dialog's oversize message carries the file name. Other pickers (dynamic form) keep legacy's plain text, as legacy
    does.
  - Insights: `yearsOnly` on `pByYearChart` and `totalPAValueByYearChart` (`widgets.ts`); `mapWidget` keeps only the
    selected years for them.
- **Already so, no change:** 9548's "refresh every chart on period change" (each widget's `useApi` is keyed on the
  filters); 9549's "clear the warning on close" (the dialog unmounts); 9554 (every Insights widget sends
  year/quarter/month).
- **Not applicable:** 9558 (CSS for JET read-only controls; the rebuild uses `ReadonlyField`); the pricing
  duplicate fix (a VBCS `oj-bind-for-each` DataProvider defect).
- **Carried to Easwar's modules (checklist):** 9559 (Proposal finalize refused while the tab's dynamic form has
  unfilled mandatory fields, RB `warning-messages.finalize-mandatory-fields`), 9545 (no View Approvers on
  sub-proposal stages of a parent proposal), 9146 (Proposal create/summary layout).
- **Shared pieces used or extended:** the attachments panel and view, `mapWidget`, the widget definitions.
- **E2E runner fix:** `npm run dev` runs `scripts/dev.mjs` since `10e996d`, but `scripts/run-e2e.mjs` did not copy it
  into the scratch project, so the journeys' server failed with `MODULE_NOT_FOUND`. It is copied now (it reads only
  `.env.dev.local`, which never enters the copy).
- **Replaces / overrides:** nothing.
- **Rules touched:** none.
- **Checks:** typecheck clean; lint 0 errors (the existing warning); 101 files / 938 tests; isolated build passed;
  e2e 42 passed, 2 skipped, 0 failed (after the runner fix). No live DEV check.
- **Open:** live check of both on DEV/621.
