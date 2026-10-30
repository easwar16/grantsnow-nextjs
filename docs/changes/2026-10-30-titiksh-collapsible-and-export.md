# One Collapsible for every expandable panel; Claims Export; report files through the API layer

- **Superseded in part (same day):** after the rebase onto `aec5020` the Export plumbing below was replaced by the
  single report-file path (`reports.generate` as a write, `fileRoute`, `download`, `reportPayload`); `oracleFile`,
  `file()` and the `POST_READS` exception are gone. See `2026-10-30-titiksh-rebase-proposals-onto-framework.md`.
- **Date / author / agent:** 2026-10-30 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 44cf6bd
- **Why:**
  - Owner (2026-10-30): the Unit Inquiry panels' arrows did not turn, and every expandable panel should be one
    reusable component, so the look is the same everywhere and nobody re-checks it. Cause: `Collapsible` left the
    summary row, the native marker and the chevron rotation to each user's CSS; Claims had none of it.
  - Owner: complete the Claims listings. Legacy claims-unit-inquiry-page has toolbar Export
    (`report-vbcs-app-unit-listing`) and row Export (`consolidated-grants-application-report`), through
    `generateReport` (a blob reply).
- **What changed:**
  - `Collapsible` owns its look (`collapsible.module.css`): the heading row, no native marker, the chevron and its
    -90° turn while closed. New props: `headClassName` (size and spacing only) and `actions` (heading buttons that
    never toggle the panel). Moved onto it: Awards Projects / Project Costs / Installments, Claims fund and claim
    status, the approval workflow's Route and History panels, the History tab's Approval History section, the
    delegation page groups, and the linked-records groups (the last three showed the browser's ▶ marker). Their
    duplicated summary, marker and chevron CSS is removed; each keeps its measured size and spacing.
  - Kept hand-written: the user menu, guide launcher, `FilterSection`, the Insights data toggle and the delegation
    person row (different controls, not section panels).
  - Export: `oracleFile` in the connection and `file()` in the client (a read that may post a body and answers
    bytes, Content-Type and the Content-Disposition name; errors keep the JSON mapping); `claims.report`;
    `serverFunctions.reports.reportPayload` (legacy generateReportPayload with its fieldLkp types);
    `fileResponse` (`server/http/response`); `download` in `lib/api/http` (bytes and name), which attachments'
    `fileBytes` now wraps. Unit Inquiry: toolbar and row Export, gated on `claims-export`, disabled while running.
    Funds Inquiry has no Export: legacy's is commented out.
- **Replaces / overrides:**
  - **Owner review needed:** `generateReport` is a POST allowlisted as a read (not behind the writes gate), as
    `generatePrintProposalReport` is (owner 2026-10-23). The catalogue script and `tests/unit/oracle-catalogue.test.ts`
    gain a reviewed `POST_READS` list (just this one) beside `GET_WRITES`; every other non-GET is still a write.
    Why: it only renders a file, and behind the gate Export would refuse wherever writes are off.
  - The approval panels unmount their body while closed (Collapsible's slide), where the `<details>` kept it.
  - The awards and contracts download routes keep their own Response code; only new routes use `fileResponse`.
- **Rules touched:** the agent guide's Collapsible row now forbids a hand-written `<details>` panel or its own
  chevron CSS.
- **Checks:** typecheck clean; lint 0 errors (existing warning); 853 unit and integration tests; isolated build passed; e2e 21 passed, 2 skipped, 0 failed. Live DEV checks in `docs/progress.md` (2026-10-30).
- **Open:** the delegation page groups were not seen live (no DEV award with delegations); fixtures cover them in
  e2e.
