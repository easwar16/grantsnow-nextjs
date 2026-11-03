# Independent reads app-wide, session-held lookups, 10-minute timeouts, constants and functions modules, dropdown width, drawer fix

- **Date / author / agent:** 2026-10-29 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on af86ddf
- **Why (owner requests, 2026-10-29):**
  - "The drop-down panel changes its width according to the content in it, so when I scroll fast, it looks
    glitchy": the panel had `min-width` of its field and grew to its widest drawn row, which changes as the window
    scrolls.
  - "Increase the max api timeout limit to 10 mins."
  - "This choices separation rule should be implemented in all places, so like 10 things don't wait for 1. So make
    it a rule."
  - "All lookups and orgUnits should be cached and used like in the live app, so there's no re-fetching."
  - "All the app-wide constants are stored in a single file/js module that exports them as object", categorised;
    split shared/server, shared-only scope (owner's choice).
- **What changed:**
  - Dropdown panels are exactly the field's width (`useDropdownPanel`, `width`, not `minWidth`); single-select
    rows end in an ellipsis, multi-select rows wrap (their heights are measured).
  - Timeouts: every Oracle call, a whole paged list and OIC at 10 minutes; the Oracle pool and a new OIC pool
    (`oicFetch`) set undici's `headersTimeout` / `bodyTimeout` to match (5 minutes by default). Chatbot (60 s) and
    the 15 s legacy save limits unchanged. The aggregate-operation list (60/90 s) is gone, as both became one limit.
  - Independent reads:
    - EOI listing: the funder dropdown reads `/api/opportunities/eoi/funders` on its own; statuses and date sorts
      stay with the shell.
    - Proposals listing: `/api/proposals/choices?group=codes|people|sponsors|departments|sorts`, read in parallel;
      the page no longer awaits the choices. Each group's failure message is unchanged.
    - Opportunities finder: `finderContext` is the shell (labels, gates, Featured preference, new-dots);
      `finderOptions` (filter options, funders, funder types, call codes, operators) and `finderBanner` stream as
      promises, resolved by the new shared `useStreamed` hook. Neither rejects; a failure toasts as before.
    - Approval workflow (every host): the history table reads `?view=history` beside the route, with its own
      skeleton and Retry; a route write forgets it with the stage approvers.
    - Shared `choiceList(read, message)` for one dropdown's options; Awards moved onto it.
  - Caching: `serverConstants.ttl.session` (12 h, per session) on every `lookups.*` read and the finder's funder,
    funder-type and call-code lists; `constants.ttl.session` on the Awards, EOI and Proposals choice endpoints.
  - Constants: `constants` (`src/lib/constants.ts`: timing, paging, ttl, limits) and `serverConstants`
    (`src/server/constants.ts`: timeouts, ttl, paging, cache, pool, session). The old local copies are removed
    (`LOAD_MORE_PX` x3, page sizes, toast/idle/announcement timings, renew lead, browser TTLs, `TTL`, Oracle/OIC/
    chatbot timeouts, 15 s saves, validation and DNS holds, paged-list limits, LRU sizes, pool keep-alive, DEV
    session lease). `src/server/oracle/limits.ts` is gone.
  - Functions (owner: pure helpers only): `functions` (`src/lib/functions.ts`: format, ids, errors, security,
    mentions, charts) and `serverFunctions` (`src/server/functions.ts`: async, sanitize, choices, resources,
    permissions, organizations), each one categorised object; every caller reads by path. Moved with their private
    helpers; `ids.ts`, `security.ts`, `chart-options.ts`, `async.ts`, `sanitize.ts` are gone; `format.ts`,
    `mentions.ts`, `errors.ts`, `choices.ts`, `permissions.ts` keep only their types and `AppError`. Services that
    read Oracle (`resources()`, `organizations()`, `displayFormat()`), environment readers and cache helpers stay.
    The chart palette and the time-zone cookie name moved to `constants`. Tests that mocked `label` /
    `resourceVisible` on the resources module now mock them on `serverFunctions` (contracts-access) or drop the dead
    override. Trade-off: anything importing `serverFunctions` loads DOMPurify and JSDOM once per server process.
  - Drawer (reproduced defect, owner framework code): the shell closed the navigation drawer in a mount effect meant
    for navigations. A click replayed during hydration opened the drawer and the effect shut it at once (e2e trace:
    click at 71.0 s, client connected at 71.2 s, drawer link then "not visible"). It now closes only when the path
    changes. This was the rotating e2e failure (Proposals x3, Awards listing) of every full run today.
  - Truncated text (owner: "all truncated fields should show title when hovered"): `TruncatedTitles`, mounted in
    `AppShell`, sets `title` on hover for any element whose ellipsis or line clamp cuts its text, and for an input
    whose value does not fit. It never replaces a deliberate `title` and removes its own once the text fits. Live DEV:
    cut Funder dropdown rows show their full names. Test: `tests/unit/truncated-titles.test.ts`.
  - Preferences drawer switches (owner: "the circle & the pill are not aligned properly"): the global switch style
    (`90e46d0`, globals.css) centres its thumb with `top: 50%` + `translateY(-50%)`; the drawer's own switch places
    its thumb with `top: 2px` but kept the inherited transform, so the thumb sat 8 px high, half outside the pill.
    The drawer's thumb now sets `transform: none` (measured after: 2 px above and below in a 20 px pill). Labels
    unchanged (an earlier label-alignment change was reverted at the owner's request).
  - Rules written: foundations (Performance: ten things never wait for one, session-held lookups, 10-minute
    timeouts; constants in one place), AGENTS.md, agent-guide §5.
- **Shared pieces used or extended:** `useDropdownPanel`, `useApi`, `usePagedApi`, `route` / `searchOf`,
  `choiceList` (new), `useStreamed` (new), `ApprovalWorkflow`, the Oracle client and pool, the OIC client.
- **Replaces / overrides:** `TTL.config` (5 min) for lookups (now session-long, as legacy); the 60/90 s Oracle
  and 120 s list limits; bundled choice replies in Awards, EOI, Proposals and the finder; the history inside
  `workflowView`. Proposals' choices are Easwar's code: same behaviour, read per group.
- **Rules touched:** Performance (extended), caching (lookups now match the live app's session hold), the
  constants rule (new). Every dropdown stays `Select` / `MultiSelect`.
- **Checks:** `tsc --noEmit` clean; lint 0 errors (1 existing `useVirtualizer` warning); `npm test` 77 files / 835
  passed; isolated build passed; `npm run test:e2e` 20 passed, 2 skipped, 0 failed (4.3 min), the first full run today
  without the drawer failures. Live DEV: Awards people and funders in 7 s while org units took 2.4 min.
- **Open:**
  - A live DEV look at the streamed finder options, the history table and the per-group Proposals choices.
