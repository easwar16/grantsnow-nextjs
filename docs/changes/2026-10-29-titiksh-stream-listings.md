# Stream listing rows and run independent page reads together

- **Date / author / agent:** 2026-10-29 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on af86ddf
- **Why:** owner request, 2026-10-29: run API calls in parallel wherever possible, and load page parts as their
  data arrives instead of stalling the page. Trigger: the Awards listing held the whole page (filters, status
  list, toolbar) for 23.7 s on `getPost_awardsAwardHeader`. The unfiltered first page takes 15–33 s on DEV, and
  VBCS sends the same request (GrantsNow KB, 2026-10-29).
- **What changed:**
  - `usePagedApi`'s `initial` also takes the server's read still streaming (`Promise<ApiResult<Page>>`). It
    answers the first request for the parameters it was rendered for, once. A failure is the list's error, and
    Retry or a refresh reads the route. A resolved page works as before.
  - `settle(read)` in `@/lib/errors`: a server read as `{ ok, data }` or `{ ok: false, error }` (public error),
    which never rejects, so it can be passed to a client component unawaited.
  - Awards, EOI and Opportunities listings: the page awaits only the shell (view and labels, format, finder
    context) and streams the first page. The lists show their existing row skeleton until it lands.
    - The finder's separate "failed server page" path (`held` / `retried`, its own toast) is gone; a failed
      first page is the list's ordinary error with Retry.
  - Proposals listing (Easwar's code, not moved onto `usePagedApi`): the labels, filter choices and format now
    load together (they were four sequential awaits). The rows start as soon as the labels give the columns, and
    stream in. The listing holds no result until they arrive, shows its skeleton, and drops the server's page if
    the query has already changed.
  - Opportunity More Info loads its shell labels beside the detail; Proposal Summary loads the format beside the
    identity and summary (both were sequential).
  - Early-started reads awaited after an early return get `.catch(() => undefined)`, as the record layouts do.
  - Rule written: foundations (Performance), agent-guide §5, AGENTS.md, api-layer.md (paged lists).
- **Shared pieces used or extended:** `usePagedApi` (extended, backwards compatible), `publicError`, the lists'
  existing skeletons and error states.
- **Replaces / overrides:** server-awaited first pages in the four listings (`9955087`, `90e46d0`). Better
  because the shell no longer waits on the slowest read; the first page is still read once on the server, never
  twice.
- **Rules touched:** Performance (extended with streaming). Latest-wins: the seed is bound to its parameters and
  used once; Proposals ignores a server page that lands after the query changed.
- **Checks:** see the session report. New `tests/unit/paged-seed.test.ts` (3): the streamed page answers without
  a request; a failed one is the list's error and Retry reads the route; changed parameters never take it.
- **Open:**
  - Record layouts (Awards, EOI) still await the record context, which decides the header and tabs (kept; it is
    the shell).
  - Home and Contracts already stream with `<Suspense>`.
  - Live DEV check of the streamed listings not run.
