# Dropdown windowing loop; Awards filter choices load per list

- **Date / author / agent:** 2026-10-29 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on af86ddf
- **Why:**
  - Owner report: the Awards listing's dropdown filters glitch. Reproduced on DEV with Funder (1,691 parties): the
    open list flipped between 12 and 1,691 drawn rows every ~400 ms and froze the tab. Measured with a
    `ResizeObserver` probe: the `<ul>` was both the scroll box and the box padded by the option window. A box is
    never shorter than its padding, so with 12 rows its padding (~45 k px) made it 45,615 px tall. The window then
    saw a 45 k px viewport, drew every row, the padding shrank, the box fell to 282 px, and it drew 12 again.
  - Owner report: the org units read fails on the Awards listing. `getPre_awardGetLkpOrgUnitType` with
    `p_obj_type: AWARD` takes ~52 s on DEV (0.8 s without the header) and often passes our 60 s read timeout.
    VBCS sends the same request and notes the same timeouts (GrantsNow KB, 2026-10-29); a backend defect. While it
    ran, every dropdown waited, because one `/api/awards/choices` reply held org units, people and funders
    together.
- **What changed:**
  - `useOptionWindow` takes the panel as its scroll box. `Select` and `MultiSelect` panels scroll
    (`overflow-y: auto`), and their lists no longer do. The `<ul>` keeps a callback ref for Downshift only.
  - `/api/awards/choices?list=orgs|people|parties` answers one list (an unknown list is a 400, checked after
    access). The listing reads the three in parallel, so each dropdown fills when its own list arrives, and a
    failed list toasts its own message and leaves the others working. Messages unchanged.
- **Shared pieces used or extended:** `useOptionWindow`, `Select`, `MultiSelect` (every dropdown in the app),
  `useApi`, `route` / `searchOf`.
- **Replaces / overrides:** the list-as-scroll-box windowing (`9955087`); the single Awards choices reply
  (`90e46d0`). Both were defects: the first loops on long lists, the second let the slowest lookup empty every
  dropdown.
- **Rules touched:** Performance (streaming: a slow read never holds the others). Every dropdown is still
  `Select` / `MultiSelect`.
- **Checks:** live DEV, Funder dropdown after the fix: 12 drawn rows in a 49 k px list inside a 280 px panel,
  stable over 3 s; scrolled to 20 k px it drew 13 rows from there. Org units loaded (14) once the lookup answered.
  New integration test: a failed org lookup returns its error while the funders load; an unknown list is a 400.
  Full checks: see the session report.
- **Open:** the backend's slow AWARD org lookup (for the backend owner). Our 60 s read timeout is unchanged.
