# Rebase onto Easwar's Proposals merge, and the Proposals record brought onto the framework

- **Date / author / agent:** 2026-10-30 / titiksh / Claude Code (one sub-agent for the Proposals move, reviewed)
- **Branch / base commit:** Saurabh, fast-forwarded to `main` `aec5020` (Easwar's "integrate VBCS parity work onto
  Azure main", via Codex); this session's Claims / Collapsible / Export work restored on top.
- **Why:** owner (2026-10-30): rebase, check whether Easwar's agent followed AGENTS.md / the agent guide, fix what it
  missed, write instructions for it, and test everything touched.
- **What changed:**
  - **Conflicts** (`operations.json`, `api/index.ts`, `client.ts`, `connection.ts`): both sides kept in the allowlist
    and exports; for report files Easwar's `writeFile` / `oracleFileWrite` kept (a POST is a write), and this
    session's `oracleFile` read, `file()` and the `POST_READS` exception removed.
  - **One report-file path:** `reports.generate` (his) for Print and Claims Export; `fileRoute` (`server/http/route`)
    serves any file, write or read; `fileResponse` takes the connection's `{ bytes, mime, filename }`; the browser's
    `download` (`lib/api/http`) does GET or POST and returns `{ blob, filename }`, and Print's `printReport` and
    attachments' `fileBytes` use it; `serverFunctions.reports.reportPayload` builds every report body.
  - **Proposals record UI** moved out of the route folders to `src/features/modules/proposals/record/` (routes in
    `(list)` / `(record)` groups, a `(record)/loading.tsx` `DetailSkeleton`); 13 tables to `DataTable`; about 45 ids;
    three `Intl` formatters to `functions.format` (`percentDisplay` gains an optional fixed-decimals flag); status
    and risk chips `StatusBadge`; Staff costing's boxed read-only spans to `ReadonlyField`; the deadline and
    versioning overlays to `ActionDialog` (modal, Escape, busy while saving).
  - **Shared connection:** the three Proposal operation names left `oracleWrite`; fixtures answer through
    `mockOracleWrite` / `mockOracleFile` in `src/test-support/transport.ts`.
  - **Shared record panels:** Comments / Audit Trail / drawer / close got ids (`<area>-<record>-comments`, …).
  - **Defects found while testing and fixed:**
    - Print sent `report_code` as `[page_name, output_file_name]`; legacy PrintMenuActionChain sends
      `selectedValue[0]`, the page name. DEV answered "report_code cannot be null." Now the page name; Print downloads.
    - The Proposal Contracts tab read `getAllContracts` with the `p_object_ref_id` header only; legacy also sends the
      `object_ref_id $eq` criterion (`p_where_clause`). DEV ignored the header and returned unlinked contracts, so the
      tab showed "Oracle returned an invalid linked Contracts page." The clause is now sent.
  - **Instructions:** agent guide §4 / §5 sharpened (route folders, `DataTable` first, ids, `functions.format`,
    `Collapsible` / `ReadonlyField` / `StatusBadge`, shared layers name no module, one function per operation), a §9
    self-check and a §10 record of this correction; `AGENTS.md` step 5 points at §9. Owner, same day: agents re-read the rules after every rebase, merge or pull, even
    mid-session, from the incoming tree before resolving conflicts and again after (`AGENTS.md` step 6, guide §2,
    with the command that lists the incoming `docs/changes/` records).
- **Structure and framework instructions (owner, same day):** guide §4 rewritten as the decided map (copy the Awards
  module; sub-applications repeat it), the one request path (page → `@/lib/api` → API route → `src/server/modules` →
  `src/server/oracle/api`) and the record framework (`RecordFrame` via a module `record-shell.tsx` fed by
  `record/shell.ts`, shared hosts, `record.ts` access); §9 gains structure and shell checks; §10 lists what is still
  off the map (Proposals and Contracts record shells and server layouts, Proposals' and Opportunities' `components/`);
  `AGENTS.md` step 2 names the map, the path and the record framework. Claims' server code was split to match:
  `src/server/modules/claims/{units,funds}/{listing,actions}.ts`.
- **Replaces / overrides:** Easwar's route-folder layout, raw tables, local formatters, fixture branch in the
  connection, hand-built overlays and the Print payload pair (each listed in agent guide §10); this session's own
  `oracleFile` read and `POST_READS` exception (`2026-10-30-titiksh-collapsible-and-export.md`): Export is now a
  write and needs writes enabled, as Print does.
- **Visible changes to review:** the converted tables use the house `DataTable` look (header colour, padding, caret
  and indent in the budget tree); budget-tree row ids are lower-case `idPart`s and its expanders `<row>-toggle`;
  credit-allocation ids sit on a span inside the cell; money and percent use `en-GB` (USD reads `US$`).
- **Checks:** typecheck clean; lint 0 errors (existing warning); 888 unit and integration tests; isolated build passed; e2e 28 passed, 2 skipped, 0 failed. Live DEV checks in `docs/progress.md` (2026-10-30, rebase).
- **Open:** a DEV proposal with linked contracts was not found, so the Contracts tab's rows were seen only empty;
  FEC Summary's analysis could not be run live (the external costing-analysis service did not answer); the older
  self-check findings outside this merge (listed in progress).
