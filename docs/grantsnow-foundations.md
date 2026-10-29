# GrantsNow foundations carried into the Next.js rebuild

Collected 2026-10-22 from three sources: the legacy VBCS app (`GrantsNow`), its knowledge base, and the
first rebuild attempt in Angular (`GN-Angular`, decisions D1–D45, frozen at `0005b12` on 2026-10-15).
This file holds the rules that still apply in Next.js. Mechanism and evidence stay in the sources it
links to. Do not copy those sources here.

Conflicts between these rules and the code were settled on 2026-10-22 (§ _Decisions 2026-10-22_). Any new
conflict goes in § _Open for the owner_; do not change that code silently.

## Sources of truth

1. **The legacy code on `origin/development`** of the VBCS repo is the source of truth for behaviour and the
   backend contract. It is read-only. Never commit, switch branches or edit there. `uat` is the
   behavioural baseline for what users see. Promotion runs `dev → demo → uat → Staged → PROD`.
2. **The GrantsNow KB** (Obsidian, `GrantsNow/KB-Meta.md` first) describes old-app behaviour, the RB/RBAC
   model, defects and failure signatures. **The GN-Rebuild KB** (`GN-Rebuild/GN-Rebuild-Meta.md`) records
   rebuild decisions and status. Findings about the old app or the backend go to the GrantsNow KB.
   Build decisions go to GN-Rebuild or to this repo's `docs/`.
3. **Prompt packs, `docs/migration/*` and other external specs are input only.** The Angular build found
   flows ported from dead chains and guessed field names in two such packs (2026-10-14). Check every
   claim against the legacy code and build from the code.
4. **The OpenAPI files show intent, not what arrives.** Build Zod schemas from real payloads and the page
   models and chains that consume them, then confirm against live DEV.

## Backend contract (ORDS `apps` / `base`, OIC)

These rules belong in `src/server/api/*` and nowhere else.

- **HTTP 200 can be a failure.** Check `status: 'ERROR'`, `response_msg` / `response_message === 'ERROR'`,
  and populated `error_code` / `error_description`. Some endpoints return a PL/SQL error **object** where
  an array is contracted, so `!response.ok` never fires. Validate the shape and do not cast it.
- **Errors carry `error_code : error_description` plus `preventive_action`.** The legacy app shows these
  verbatim in a transient toast. The rebuild passes only those three fields to the client (`businessError` in
  `src/server/oracle/connection.ts`); `State` shows the preventive action under the message.
- **Dead-session replies are not uniform.** One of them is the literal text `Context Not Set: N`. Match
  it to "session expired", not to a generic failure.
- **Paging is `p_offset` / `p_limit`** everywhere except the claims `unit-funds-list` / `fund-inquiry`
  endpoints (`offset` / `limit`). Live DEV, 2026-10-22: the Proposal listing pages by 10, Home queues by 25.
  `hasMore` is unreliable (a short last page can say `"true"`, a mid page `"false"`): use `total_count`
  when present, else "the page came back full". `size` is never a total; page rows are never the API total.
- **List filters are a SQL `p_where_clause`, built on the server.** Live DEV, 2026-10-22, title filter:
  `p_where_clause=(LOWER("proposal_title") LIKE LOWER('%test%'))`. Sort is `p_order_by="col"` +
  `p_sort_order`. Columns come from a fixed allowlist and values are quoted literals with `'` doubled
  (`src/server/modules/proposals/where-clause.ts`); the browser never sends SQL. `services/apps/transforms.js` (ORDS
  `q` JSON) is unused by the legacy app.
- **Header names vary by operation** (`token` vs `p_token`, `org_id` / `org-id` / `p_org_id`, header
  casing). Copy them from the legacy call site into `operations.json`. Never normalise them.
- **Build every write payload with an explicit pick** (a `toPayload()` per entity). VBCS typed variables
  silently dropped undeclared keys. React does not, so posting a view model would send every field the UI
  ever saw.
- **Identity comes from the server, never the browser.** That covers `person_id`, `org_id` and `legal_id`
  for scope, and the approval actor (legacy sends `action_by` from the client; derive it from the session
  instead). The session token never goes in a URL (D25). The digital-presence save's contract puts it in
  the query string; send it as a header.
- **Who the user is comes from `base/session/validate`**: `pid`, `org_id`, `org_name`, `full_name`,
  `legal_id` (Angular D45, as legacy `current_user`). Validate has no email. Default dashboard org is
  validate's `org_id`.
- **Run validate once per token, not on a poll** (D24). Extend the token about one minute before
  `expiry_datetime` via `session/extend_token`, then schedule again from the returned expiry. An unchanged
  expiry schedules nothing (D37). This repo validates per protected request on the server, which already
  covers revocation. Do not add a client poll.
- **Module access:** a module needs `module_access[].is_accessible === 'Y'`. In the drawer, a group needs its
  own id and each child needs its own. Home and Announcements always show. Unknown access fails closed:
  legacy showed everything, and the rebuild does not (D24).
- **Files:** attachment records live in ORDS (`/pre_award/attachments/`). The bytes go to Object Storage through
  OIC (`UPLOAD_OBJECT` / `GET_OBJECT` / `DELETE_OBJECT`), which needs Basic credentials. That must be a
  server-side relay here, never browser credentials. `UPLOAD_OBJECT` accepts only
  `application/octet-stream` (415 otherwise). Object keys stay deterministic
  (`…/<objectNum>/<module>/<file name>`): the duplicate-name gates rely on one object per name per record.
  Make names header-safe only by percent-encoding non-Latin-1 characters.
- **Dates:** `new Date('YYYY-MM-DD')` is UTC midnight and shows one day early west of UTC. Parse
  date-only values as calendar dates. Legacy overdue logic uses truncated-day comparisons.
- **Decimals are view-only.** Format with `maximumFractionDigits: DECIMAL_PLACES_COUNT || 2`. Never round
  values that are sent or stored. Financial masks are shown verbatim.
- **Backend HTML** (announcements, opportunity summaries, chatbot answers) is sanitised once on the server.
  CKEditor content needs its `.ck-content` / `text-*` / `marker-*` classes kept where it is shown.
- **Legacy deep links** `?page=shell&shell=<module>&<module>=<page>&<id>=…` are emitted by backend
  notifications and reports, sometimes with `=` where `&` should be. Old emails live forever, so keep a
  redirect shim for that scheme.
- **The chatbot** (`http://140.238.102.187:8000`) is plain HTTP on a raw IP. It rejects a localhost Origin
  in CORS, and `/query` returns a 307 to an absolute `/query/`. The question travels in a `user-query`
  header. Proxy it server-side and call `/query/`. The improvement list is in GN-Rebuild § _Chatbot: later_.

## Resource bundles (RB) and visibility

- **Merge direction:** local seed defaults first, backend rows on top, so the backend wins and seeds fill
  the gaps (`_.merge(strings, backendRows)` in legacy `shell-page.js`). Keys are lower-cased per module.
  Here, the seeds are `src/server/platform/configuration/resource-defaults.json`, generated from legacy's runtime seed
  `webApps/app/resources/js/strings.js`, covering all 11 bundles with their label, visibility, mandatory flag,
  description and preferences. Run `node scripts/resource-seed.mjs` after legacy changes, and `--check` to verify.
  Seeds the rebuild owns, each arriving with `'N'`, go in `resource-additions.json` and never into the generated file.
- **Field by field, as `_.merge`:**
  - A field the backend omits keeps the seed's.
  - An empty description or absent preferences also keeps the seed's.
  - Any other backend value wins, `null` included. A null label then shows the use site's literal fallback, as
    legacy's `translations[m][g][k] || 'literal'` does.
- **Fail closed:** a control shows only when its entry has `is_visible === 'Y'`. A missing bundle, key or
  flag hides it. The helpers never throw on a missing module, group or key. Re-confirmed by the user on
  2026-10-22 for everything RB-driven: gate it with `resourceVisible`, and never use a code default of visible or
  "shown unless `'N'`", even where GN-Angular did. Opportunities/EOI follow this rule: card buttons, Home meta
  cells, summary fields, site, counts and More Info actions.
- **Bundle fallback:** a per-type proposal bundle (`outline_proposal`, `sub_proposal`, …) that is not
  provisioned falls back to `proposal`. A key missing inside an existing bundle does **not** fall back,
  because the gap may be intentional.
- **A new field is done only when it has all five of these.** Legacy ticket 8886 is the reference.
  1. A seeded default with `is_visible: 'N'`.
  2. A literal label fallback.
  3. A visibility gate.
  4. A required gate.
  5. For editable fields, a More Info help button whose text comes from the entry's `description`.
     Check existing gates first, and say so if an `'N'` would hide something currently on screen.
- **Promote with visibility off:** anything new going to `uat` or higher arrives with `'N'`. Never carry a
  `'Y'` upstream. Each environment has its own backend bundle.
- **A label is never a feature flag.** Gate on the visibility metadata, not on label text.
- **Strip hidden fields on the server.** A hidden field never reaches the client DTO. Hiding it with CSS
  is not enough.

## Behaviour proven in the Angular build (port the rule, not the code)

- **Write gate:** every backend write passes one gate that is off by default (Angular D27,
  `writesEnabled`). Turn it on only for a named test against a designated DEV record, then turn it off.
  This matches this repo's rule that browser access does not authorise live mutations.
- **A save blocks its control until it ends, and nothing is throttled** (D44). Every user-triggered write
  disables its control from click to settle, whether it succeeds or fails. That covers save, create,
  submit, delete, toggle and finalize. Per-item controls block only their own item. A confirm-then-send
  flow is one pending unit, so the confirm cannot open twice. Saves take from under a second to about
  10 s, so no throttle window works. Debounce only input that repeats by design (search-as-you-type,
  scroll paging).
- **Dynamic forms engine** (D40, D42; legacy `dynamic-form`, 28 hosts):
  - Hidden fields are disabled, so they skip validation and are sent **empty**.
  - GRID rows are keyed by `fieldId`, not the column label. One row is edited at a time. A row missing a
    required column cannot be committed. Deleting every row clears the table.
  - An empty number stays empty, not 0.
  - FILE saves run deletes, then uploads, then answers, and **stop at the first failure**.
  - The file folder uses the record number, so it is read after create (legacy wrote `/undefined/`).
  - `ETHICS` / `DUE_DILIGENCE` map to `RESPONSES` scope in one function.
  - Size limit is `DEFAULT_SIZE_FORMAT` (4 MB) and types come from `ALLOWED_EXTENSIONS`. Names are unique
    across the form.
  - Leaving a page with unsaved changes asks first.
- **Record pages:**
  - Each tab is a child route, so back and forward work.
  - Tabs share per-record state instead of re-fired events.
  - Object roles come from `security/user_roles` with `p_obj_type` / `p_obj_id`.
  - Lock and finalize state comes from `getLockedModules` / `getLockStatus`.
  - Comments and audit trail are shared components that take `(objectType, objectId, page)`.
- **Unbuilt modules** open an in-app placeholder route. Only external tools (APEX Reports and
  Administration, Support, API docs) open a new tab (D23).
- **Each dashboard widget and chart is a definition in data**: endpoint, org header, chart type and a
  row → view-model mapping. A slow or failing panel degrades on its own and never holds the page.
- **Libraries that measure their container** (ECharts, FullCalendar) need a `ResizeObserver`, because
  they only listen for window resizes.
- **Open backend questions carried over:**
  - An existing record's form omits fields added after its answers were saved.
  - Most never-saved draft applications get no sections.
  - It is unverified whether `base/getSessionLogin` is as open as `session/validate` on DEV.

## Look and feel (owner's brief, carried from Angular)

- **Match the live DEV VBCS app, and measure it.** Check computed styles and bounding boxes at the same
  viewport, and do not judge by eye (D8).
- **The document never scrolls; components do** (D35). Anything `position: absolute` needs a positioned
  ancestor inside its scroll container. A stray `sr-only` label once made the main area scroll on every
  page load. Applied: `<main>` is the one scroll container; a full-height page takes `.page-fill`.
- **Layout follows the viewport** (owner, 2026-10-26):
  - Widths and heights of pages, columns, panels, drawers and dialogs are `vw` / `vh` wherever possible, and
    `%` / `fr` otherwise. Translate a measured JET grid fraction (`oj-sm-10` → `83.333%`).
  - Grid tracks take `auto` where legacy sizes to content.
  - Use no fixed px widths or caps on layout. px are for component details only: borders, icons, radii, control
    heights, small gaps.
- **Form fields are one size, 28 px,** set in rows of equal cells, with related fields sharing a row (D36).
- **Use one loading placeholder,** the skeleton with `role="status"`, not "Loading…" text (D30).
- **Use one motion system,** driven by the CSS tokens. Honour `prefers-reduced-motion`, and give dialogs exit
  animations too (D29).
- **Colours, fonts and radii come only from tokens.** Oracle Sans comes from Oracle's CDN, with Open Sans as
  the fallback.
- **Add no dependency until the owner agrees to it,** one library at a time as the need arises.

## Engineering rules (owner's style, from the VBCS and Angular work)

- **Centralise.** Anything two modules need becomes one component or helper driven by backend metadata.
  Module differences live in data.
- Prefer small pure functions, guard clauses and early returns. Use `?.`, `??`, destructuring and default
  params.
- **Test for emptiness explicitly** (`=== null || === undefined || === ''`). `0` and `false` are valid
  values.
- **Comments say why in one line, two at most.** Keep JSDoc for non-obvious contracts. Verify a comment
  before trusting it, and fix it when you touch its code. Longer reasoning goes in docs or the KB.
- **Bound every wait or loop** with timeouts or safety counters. Do not port legacy polling for
  late-arriving params; pass the data down instead.
- **Degrade, don't abort,** when one element is bad.
- **Use try/catch only where something throws and the catch does something useful.** No empty catches,
  no `.catch(() => {})`, and no console-only catch that hides a failure from the user.
- **Keep diffs minimal.** Fix at the true cause and flag neighbouring problems separately. Add state,
  helpers or params only when strictly needed. No single-use wrappers.
- **Invent nothing.** Add no checks, toasts, payload changes or defaults without an identified defect.
  When reverting, return to HEAD exactly.
- **Every section and element is uniquely identifiable by `id`** (owner, 2026-10-22, for later use):
  - Applies to page sections, landmarks, panels, dialogs, popups, tabs, lists, forms, filter groups, and
    every control and action.
  - Ids are kebab-case `<area>-<element>`, short and readable: `finder-search`, `finder-status`,
    `advanced-filter-keyword`, `eoi-record-tabs`.
  - Repeated items append their record key, made readable with `idPart` (`src/lib/ids.ts`: camelCase and
    spaces become dashes): `opportunity-7400442`, `eoi-3934`, `widget-p-pending-approvals`.
  - A shared component takes its id (or an id prefix) from the page that uses it, so two instances never
    clash. `useId` is only for internal ARIA wiring, never for these ids.
  - Ids are stable: never derived from labels, RB text or array index, and never renamed without a reason.
- **Every interaction and update animates** (owner, 2026-10-22):
  - A zero-specificity baseline in `globals.css` covers colour and border transitions, checkbox pops, dimming
    while busy, and list rows rising in.
  - Collapsibles use `.gn-collapsible` / `.gn-collapse`. A `<details>` must stay `display: block`, or it jumps
    instead of animating.
  - Anything that animates out before unmounting uses Motion (`motion@13.5.1`, `motion/react`): `AnimatePresence`
    with the presets in `src/lib/motion.ts`, which copy the CSS tokens, and `Pop` (`src/components/ui/pop.tsx`)
    for popups. The app shell's `MotionConfig reducedMotion="user"` honours reduced motion. Enter-only
    animations stay CSS.
- **Listing filters share one look:**
  - `FilterPanel` holds the column. `FilterStack`, `FilterClear`, `FilterSection`, `FilterChoices` and
    `SortControl` (`src/components/ui/filter-section.tsx`) build its contents.
  - Clear comes first, then one collapsible section per filter, titled by its RB label.
- **Date fields use `DateInput`:**
  - The placeholder and the typed text follow `getGlobalVar` `DEFAULT_DATE_FORMAT`, as legacy's
    `global_metadata` does.
  - The value stays ISO `yyyy-mm-dd`, and the calendar button opens the native picker.
- **Scrolling areas are positioned.** `.page-fill` and scrolling lists set `position: relative`. Without it,
  absolutely placed `.sr-only` text escapes to `main` and adds a second scroll bar.
- **Performance: parallel by default, without races** (owner, 2026-10-22):
  - Independent work, whether Oracle calls or our own async functions, starts together (`Promise.all`, or
    start the promise early and await it late). Only a step that needs an earlier result waits for it.
  - Paged reads fetch the first page, then the remaining pages together once the total is known.
  - **A page never waits on data it does not draw first** (owner, 2026-10-29). DEV reads can take 20 s or more
    (the unfiltered Awards listing measured 15–33 s), so a slow read must not hold the shell.
    - A page or layout awaits only what its shell needs: identity, access, the RB labels and gates, the format,
      and the record context that decides the header and tabs. Each of these starts as soon as its inputs exist.
    - Lists, sections and panels stream. A client list takes the server's first read as a pending promise:
      `initial: functions.errors.settle(read)` (it never rejects) into `usePagedApi`'s `initial`. Server-rendered
      sections go behind their own `<Suspense>` with a `Skeleton` fallback (Contracts, Home). The rest of the page
      is usable while they load, and each fills in when its data arrives.
    - A read started early but awaited after an early return gets `.catch(() => undefined)`, so it is never an
      unhandled rejection.
    - Never stream a read whose failure must replace the whole page (access, a missing record).
  - **Ten things never wait for one** (owner, 2026-10-29). Independent pieces are never bundled into one reply
    or one await: each dropdown's options, panel, section, table and banner is its own read and fills when its
    own data arrives. A slow or failed piece shows its own skeleton or error, and every other piece keeps
    working.
    - Browser reads: one endpoint per piece, read in parallel (`useApi` each). Where one route serves several,
      it takes the piece as a parameter: `/api/awards/choices?list=orgs|people|parties`,
      `/api/proposals/choices?group=…`, a workflow's `?view=history`.
    - Server-rendered pieces: pass each as its own pending promise (`functions.errors.settle(read)`, or a read that degrades on
      its own) and resolve it with `useStreamed` (`@/lib/hooks/use-streamed`), as the finder's options and
      banner do. Otherwise give each its own `<Suspense>`.
    - A dropdown list degrades alone: `serverFunctions.choices.choiceList(read, message)`
      returns `{ options, errors }`, so its failure toasts its own message and leaves the rest of the page.
    - Gathering stays right when one answer needs every read: a record context, a write payload, a figure
      computed from several reads.
  - **Lookups and org units are held for the session** (owner, 2026-10-29), as the live app holds them
    (`orgUnitsLookup`, `loadLookups`). Server: `serverConstants.ttl.session` on every `lookups.*` read and the
    finder's funder, funder-type and call-code lists. Browser: `constants.ttl.session` on the dropdown-option
    endpoints. A failure is never held, so a failed lookup is asked again on the next visit.
  - **Backend calls wait up to 10 minutes** (owner, 2026-10-29): `serverConstants.timeouts.oracle` / `.oic`,
    on the call, the whole paged list and the undici pool (`headersTimeout` / `bodyTimeout`, which default
    to 5 minutes). Saves that legacy bounds at 15 s keep that limit.
  - Reference data Oracle answers slowly and the app never writes (labels, global variables, lookups, roles,
    org and person lists) goes through `memo` (`src/server/oracle/cache.ts`). It is keyed by session, shares one
    request between concurrent callers, never reuses a failure, and expires after a TTL. A write that changes
    memoised data calls `forget` for it.
  - **Cache by habit** (owner, 2026-10-22). Hold everything the VBCS app holds app-wide:
    - session and roles, labels, global variables, dashboard and user preferences, themes;
    - people and org lists, lookups, object dates, funders and preference options;
    - person status, the opportunity "new" flags, notifications.
      Also hold anything this app reads in more than one place (announcements, record roles, dialog setups,
      recipient lists, org units per PI). Server side this uses `memo` / `cachedRead` (`src/server/cache/`);
      client side, the app store (`src/lib/store/app-store.tsx`, `useReducer` + Context, behind `useRemote` and the
      dialogs' reads). Every write that changes held data clears it (`forgetRead` / `forget`, in `finally`).
  - No races: writes stay ordered, a request's own steps that depend on each other stay sequential, and
    client fetches keep their latest-wins guards (`LatestRequest` / aborts), so a slow earlier response never
    replaces a newer one.
  - Interactions must not block the main thread. Measured on the finder (2026-10-22): each click cost
    120–160 ms of re-rendering every card and the funder tree, which made animations stutter. Heavy list items
    (cards, rows, trees) are `memo`ised, and the callbacks passed to them are stable (`useCallback` with
    functional state updates), so a click re-renders only what changed.
  - Rise-in animates only record rows tagged `.enter-rise`, as GN-Angular did, never every list item.
  - Development logs every Oracle call over 1 s (`[oracle] op: N ms`), so latency is traced before it is fixed.
- **App-wide constants live in one place** (owner, 2026-10-29), as one object grouped by category:
  `constants` in `src/lib/constants.ts` (both sides: timing, paging, browser TTLs, limits) and `serverConstants` in
  `src/server/constants.ts` (server-only: timeouts, server TTLs, paging, cache, pool, session). A constant two files
  use, or a tuning value (a timeout, TTL, page size, wait or limit), goes there and is read by its path
  (`constants.paging.awards`); a value one file uses stays beside it. Never redefine one locally.
- **Shared pure helpers live in one place** (owner, 2026-10-29), the same way: `functions` in `src/lib/functions.ts`
  (both sides: format, ids, errors, security, mentions, charts) and `serverFunctions` in `src/server/functions.ts`
  (server-only: async, sanitize, choices, resources, permissions, organizations). A pure helper (no Oracle, cache,
  storage or settings read) that two files use goes there and is called by its path
  (`serverFunctions.permissions.requireModule(user, "AWARD")`). Services that read Oracle stay in their modules, so
  tests can mock them by path; mock a helper on `serverFunctions` (see `tests/integration/contracts-access.test.ts`).
  Types and classes (`AppError`, `FormatSettings`, `Choice`) stay in their modules.
- **Truncated text always shows its full value on hover** (owner, 2026-10-29). `TruncatedTitles` (in `AppShell`)
  titles any element whose ellipsis or line clamp is cutting its text, and any input whose value does not fit. Keep
  truncating with `text-overflow: ellipsis` or a line clamp so it is covered; set your own `title` only when the tooltip
  should say something else (it is never replaced).
- **Names are sensible and short.** Variables, functions, CSS classes and ids say what the thing is in one to
  three words. No abbreviations a reader has to decode, and no long compound names.
- **Mark a deliberate shortcut** with a `// ponytail:` comment that names its ceiling and the upgrade
  path.
- **Diagnose before editing.** A one-line error is not a diagnosis. Get the full stack, or a decisive diff
  of vendor or source code, first. When a fix fails, say what that rules out before trying the next one.
- **When a result doesn't match the source, suspect a stale cache first.** Next's `.next/dev` produced an
  HMR loop here. Angular's `node_modules/.vitest-cache` served old compiles.

## API layer (owner, 2026-10-23)

- **Single entry points.** All Oracle access goes through `@/server/oracle/api`, made of functions defined with `read` and `write`. All browser access goes through `@/lib/api`, made of endpoints, write functions, `useApi` and `usePagedApi`. The full rules are in [api-layer.md](api-layer.md).
- **Identity is never passed by hand.** It comes from the request's verified session. Each function names the identity headers it sends.
- **Caching follows the parameters.** The same operation with the same parameters is answered from the held copy: once per request by default, or per session with a TTL for reference data. Writes clear what they change. Listings are paged and cached per page, and whole reference lists are read across their pages.
- **Libraries** (owner, 2026-10-23): use lodash and moment where they simplify. Legacy relies on both (`_.merge` for translations; moment for date formats and month arithmetic), so they also keep behaviour identical. Any other new dependency still needs the owner's agreement.
- **Caching** (owner, 2026-10-23): what the live app caches, plus the owner-approved performance holds listed in [api-layer.md](api-layer.md). Writes always read fresh.
- **Every dropdown searches** (owner, 2026-10-22 and 2026-10-23): a dropdown is `Select` / `MultiSelect`, which takes type-to-filter in the field itself and still requires a pick from the list, as legacy's `oj-select-single` does. There is no native `<select>` anywhere, and the search never sits in a separate box that can break the layout.
- **No focus ring on click** (owner, 2026-10-23): `InputModality` marks `<html data-input>`; after a mouse, touch or pen press nothing draws an outline, border ring or switch ring, fields included. Keyboard navigation keeps every ring (WCAG 2.4.7). A ring drawn on a wrapper or sibling (`:focus-within`, `+ .track`, an open `Select`) is gated where it is set with `:where(:root:not([data-input="pointer"]))`, which adds no specificity.
- **Data libraries** (owner, 2026-10-23): TanStack Query under the app store; lru-cache for the server cache; Downshift and TanStack Virtual for comboboxes; Floating UI for overlay positioning; Motion for enter and exit animations.
- **Code arriving from other branches** (Easwar's Proposals and Contracts) is moved onto this layer when it lands.

## What not to carry

- VBCS concepts: chains, `$application` / `$page` scopes, SDP/ADP, `oj-*` tags or classes, translation
  store paths, Redwood/JET workarounds. The `vbcs-grantsnow` skill applies only to the legacy repo.
- Angular mechanisms: RxJS streams, NgZone, CDK overlays, `InFlight`, `LABEL_MODULE`. Keep only the
  behaviour.
- VBCS hidden-behaviour workarounds H1–H28 (KB `GrantsNow-Migration.md`). The exceptions are H1 (explicit
  payload pick), H11 (RB merge order), H22 (200 + ERROR) and H26 (legacy deep links), which must be
  reproduced on purpose.
- Legacy defects listed per screen in the GrantsNow module notes. Design them out and record which.
- Angular's session architecture: a pasted browser token, ORDS called from the browser, and the dev proxy
  injecting OIC credentials. This repo's server-side BFF (IDCS + sealed cookie + allowlisted transport)
  replaces it. That BFF is the KB migration study's option (a).

## Decisions 2026-10-22

The owner asked for behavioural conflicts to be settled against the live DEV app, owner rules to win where
they exist, configured values to be used, legacy defects to be fixed and access to be role based. Framework
and improvement choices stay with the owner (§ _Open for the owner_).

| Conflict                                                                   | Settled by                                         | Now                                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Listing filters sent as ORDS `q` JSON                                      | Live DEV network + legacy `services/transforms.js` | SQL `p_where_clause` / `p_order_by` / `p_sort_order`, server-built from an allowlist |
| Paging `offset` / `limit`, 5 rows with Prev/Next on Home                   | Live DEV (`p_limit=25`) + GN-Dashboard rule        | `p_offset` / `p_limit`; Home queues 25 per page, scroll, cap 100                     |
| Trusting `hasMore`                                                         | GN-Dashboard live note                             | `total_count`, else full page                                                        |
| Backend error text hidden                                                  | Owner rule                                         | `error_code : error_description` + `preventive_action`, nothing else                 |
| `Context Not Set` shown as a contract error                                | KB + GN-Angular                                    | Session expired                                                                      |
| No automatic token extension                                               | D37                                                | Extend one minute before expiry, reschedule from the reply                           |
| Per-key fallback to the `proposal` bundle                                  | Owner decision 2026-10-19                          | Fallback only when the per-type bundle is absent                                     |
| Summary shows fields unless `'N'` (legacy)                                 | Owner decision 2026-10-19                          | `'Y'` only, everywhere                                                               |
| Any role row grants object read                                            | Make it role based                                 | Every row for the page must grant it                                                 |
| Drawer group shown if any child is granted; placeholders shown to everyone | D24 + legacy `getNavigationItems`                  | Group needs its own grant; placeholders need theirs                                  |
| External tools as in-app placeholders                                      | D23 + live drawer                                  | New tab, per-environment URLs (`APEX_*`, `CUSTOMER_SUPPORT_URL`)                     |
| Configured decimals and date format unused                                 | Use configured things                              | `DECIMAL_PLACES_COUNT` / `DEFAULT_DATE_FORMAT` on every screen                       |
| Overdue: every proposal deadline pink; tomorrow overdue                    | Fix legacy defects                                 | Correct date field per queue, calendar days, due today or earlier                    |
| Settings save posted the whole GET body                                    | H1                                                 | Contracted keys only                                                                 |
| Two opportunity cards                                                      | D32                                                | One shared card                                                                      |
| Document scroll, 38 px fields, no motion system, grid layouts, raw colours | D35, D36, D29, D7                                  | Applied in `globals.css`                                                             |
| Unrecognised legacy email links                                            | H26                                                | Redirected to the new routes                                                         |
| Live writes ungated                                                        | D27                                                | `WRITES_ENABLED=false` by default                                                    |

## Decisions 2026-10-22 (owner's second round)

| Owner instruction               | Done                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOMPurify if better             | Yes: legacy `renderAsHTML` uses it, it parses like a browser and keeps authored styles/tables (D15). Server-side with jsdom (`src/server/platform/sanitize.ts`), hardened: no `<style>`/form controls, no positioning or `url()` in styles, links new-tab, http(s)/mailto/relative only. `sanitize-html` removed                                    |
| FullCalendar                    | 6.1.22 via `@fullcalendar/react` (D17), loaded on first Calendar View (D19), ported legacy/GN-Angular calendar                                                                                                                                                                                                                                      |
| Dependencies                    | `sanitize-html` and its types removed; everything left in `dependencies` runs in production (zod validates every Oracle reply); test/tooling packages are dev-only                                                                                                                                                                                  |
| Agreed fonts and styles         | Oracle gallery bundle linked as VB/GN-Angular do (Oracle Sans + `oj-ux-ico` glyphs, D13/D14), Open Sans listed as fallback, `<Icon>` component, GN tokens and component styles                                                                                                                                                                      |
| Charts we had                   | Every GN-Angular Insights and Dynamic chart, drill-downs, legend truncation, FEI gauge, funnel, stacking                                                                                                                                                                                                                                            |
| Filters on the left, adjustable | One `FilterPanel` on Proposals, Opportunities and EOI: drag or keyboard resize, per-browser width, collapsible                                                                                                                                                                                                                                      |
| Chatbot, bottom right           | Server proxy `/api/chatbot` (session token added server-side, answers sanitised), gated by `CHATBOT_URL` + global var `CHATBOT_ENABLED=Y`, draggable launcher snapping to edges, default bottom-right                                                                                                                                               |
| Real data not loading           | Machine DNS: the router stalls on IPv6 (AAAA) lookups, so Node needs ~6 s per lookup and parallel requests hit the 10 s connect timeout. Fix is local DNS. App hardened: one 10-minute timeout per call (owner, 2026-10-29), one validate per token per 60 s (D24), seeded labels when `shared/labels` is unreachable, dev-only failure diagnostics |

Later the same day: the hover-only "Refresh" buttons on Home widgets (Need Attention, Notifications, Featured,
Dynamic Charts) were removed at the owner's request, to be re-added if needed; the error-state "Retry" stays. The dev
origin is `http://localhost:3000` (as GN-Angular's `localhost:4200`), still loopback-only and exact for the Origin
check and the host-only cookie. Development servers resolve the ORDS hosts over IPv4 first (`src/server/platform/configuration/dev-dns.ts`),
because this machine's router stalls on AAAA lookups (Node waited ~6 s per lookup; DEV round trip now ~1 s).

## Dashboard and chatbot parity with GN-Angular (2026-10-23)

Built from a code-level gap list against GN-Angular and checked in the browser against live DEV and the live VBCS app:
header Help and notification bell (unread count, day-grouped popup, mark-read on close), 30-minute idle dialog, drawer
geometry and "new" dot, profile dialog with Digital Presence, Preferences/Accessibility as a push drawer with DEV custom
themes and GN-Angular's accessibility effects, toasts, More Info help buttons (`label_description`), auto-advancing
announcements, org picker with depth indent, KPI/tab/widget geometry, Ethics access check, Insights multi-select filters
(quarter → month), opportunity card actions (bookmark, share, comments, notes, apply, convert), infinite scroll in
Featured and Notifications, Dynamic Charts menu and tiles, and the chatbot launcher, Send, mic and typing indicator.
All writes go through `oracleWrite` and stay off (`WRITES_ENABLED=false`). Live findings: approval queues are due from
their creation date (owner's GN-Angular decision, matches live); announcement text is white on brand (only CKEditor
markers are black); DEV has no featured opportunities.

## Decisions 2026-10-24 (audit fixes, checked against the GrantsNow KB)

| Finding                                                                         | Settled by                                                                   | Now                                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| EOI Application attributes editable but never saved                             | Legacy `saveAttributes` only copies the values; the EOI save posts none (KB) | Shown read-only on EOI until an attributes write exists                                                           |
| Form file save deleted the old file before uploads and answers (D42 order)      | Fix legacy defects (D42's own aim: no answer pointing at a missing file)     | Same-name replacements deleted first, other deletes after the answers save                                        |
| `~~` in a grid cell shifted later rows                                          | Legacy `~~` row encoding (KB Dynamic Forms)                                  | Cell refused on Done; server refuses unequal column row counts                                                    |
| New sub-folder upload stored under the parent folder                            | Legacy `FilePickerSelectChain` + `insertAttachmentActionChain` (defect)      | Stored under `folder~~newFolder`, as uploads into an existing sub-folder already are                              |
| NUMERIC value rounded on blur                                                   | Owner rule: decimals are view-only; legacy keeps 12.345                      | Display rounded (lodash `round`), value kept                                                                      |
| Delegation minimum start date from the server's UTC day                         | Legacy `getCurrentDate()` is the browser's day                               | Browser's local day                                                                                               |
| Share / notes / bookmark wrote for any opportunity id                           | Scope at every service boundary (AGENTS)                                     | Opportunity re-read first, as Apply and Convert do; no new page gate (legacy has none for Share)                  |
| Write bodies buffered whole before the size check; callback GET cleared session | Engineering rules                                                            | `readText` byte cap (`src/server/http/body.ts`); a callback with no sign-in in progress leaves the session        |
| Background refresh re-stored data a write had cleared; all-pages read unbounded | API layer rules                                                              | Refresh stored only if its entry is unchanged; one 120 s deadline per all-pages read; validations on `globalThis` |
| Write timeout told the user to retry                                            | Engineering rules (no double writes)                                         | "The change may have been saved; refresh before trying again" unless the connect never reached Oracle             |
| Featured stale after a research-preference save                                 | API layer invalidation                                                       | The save also drops `getSharedGetOpportunities` and its new-flags read                                            |

## Decisions 2026-10-26 (owner open items; IDCS items left open)

| Item                                      | Now                                                                                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LIKE wildcards `%` / `_` unescaped        | Fixed: every "contains" filter goes through `containsClause` (`src/server/oracle/where.ts`), `\`-escaped with `ESCAPE '\'`                                                                |
| Overdue on the server's calendar day      | Fixed: the shell sets a `gn-tz` cookie (IANA zone); Home queues count days on that zone's today (`viewerToday`), server day until set                                                     |
| FX rates accept 0 and negatives           | Fixed: a rate must be above 0 (server schema; the box is marked invalid and Save waits)                                                                                                   |
| Oracle catalogue widened the allowlist    | Removed: 103 allowlisted operations, each named by the server (test); `scripts/oracle-catalogue.mjs` writes ORDS output to preview only                                                   |
| Cache bounded by count only               | Fixed: also 64 MB of answer JSON; an answer larger than that is not held                                                                                                                  |
| Same-name uploads racing on one record    | Fixed per process: one upload per object path at a time (`exclusiveLocation`), the name check read under that hold                                                                        |
| Uploads copied in memory, downloads whole | Kept: both bounded by the configured upload limit (`maxMb`, 4 MB on DEV)                                                                                                                  |
| Filter-panel width per browser            | Kept: a layout convenience, not account data; no server preference contract for it                                                                                                        |
| Two grids for 12-column chart spans       | Kept: the spans are backend-driven                                                                                                                                                        |
| Floating-label fields on Proposal listing | Kept: live uses inside labels on listing drawers, as `InsideField` does on the EOI list; D36's 28 px is for top-label forms                                                               |
| Confirmed on DEV                          | ORDS accepts `ESCAPE '\'`; `total_count` is filtered (47 of 1,376); `pendingApproval` / `approvedAwards` carry no `appr_deadline_date`, so those queues never show overdue (legacy alike) |
| Label bundles were a fixed list           | Fixed: `getSharedLabels` asks for the user's bundles (legacy findModuleAccess; AWARDS → AWARD), so Awards reads DEV's own labels                                                          |
| Chatbot token over plain HTTP to a raw IP | Infrastructure: needs TLS on the chatbot host; the app already keeps the token server-side                                                                                                |

## Open for the owner

Framework and improvement choices only:

- Chatbot host: TLS (the session token reaches it over plain HTTP, as in legacy).
- Sessions end at the ID token's `exp` (docs/authentication.md); confirm the IDCS ID-token lifetime on DEV.
