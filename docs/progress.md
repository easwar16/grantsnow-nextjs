# GrantsNow rebuild — progress, plan and history

One file for where the rebuild stands. It merges four earlier documents verbatim, with their headings moved down one level:

1. Current progress, newest increments last (formerly `vbcs-parity-progress.md`).
2. The parity plan the owner approved on 2026-10-14 (formerly `vbcs-parity-implementation-plan.md`), which AGENTS.md cites.
3. History: the first increment's status and checklist (formerly `implementation-status.md` and `implementation-checklist.md`).

## 1. Progress

## VBCS parity implementation — current progress

Updated 2026-10-14. Approved plan: § 2 below. This records an implementation batch, **not completion of the full migration**.

### Implemented in this workspace

- IDCS tenant-hosted metadata retrieval separated from advertised issuer. Fixed HTTPS discovery URL, exact expected issuer, same approved tenant origin for authorization/token/JWKS/logout/userinfo, code/S256/RS256 support and registered client-auth method validated before constructing the real openid-client Configuration. Signature checks remain enabled; rejected metadata requests can retry. Basic and POST confidential-client methods supported; other methods require an approved adapter.
- `.env.example` now includes IDCS_DISCOVERY_URL and IDCS_CLIENT_AUTH_METHOD. No real client/service secrets copied from the browser or legacy catalogue. Live trust gates remain disabled.
- Compact VBCS-derived colors, typography/density, header and original white logo; responsive navigation drawer with keyboard dismissal/focus return, user menu/session actions, light/dark foundations. Oracle Sans 400–800 faces reference the same verified Oracle CDN resources used by live VBCS, without copying proprietary font binaries or importing all gallery styles. Font availability/CDN policy must be included in hosting review.
- Home organization heading/filters, Need Attention and Insights keyboard tabs, dense attention rows/metadata, sanitized announcements carousel/collapse, configured KPI strip with API metrics/trend data and the current source sparkline geometry. Existing nine queue/eight statistic adapters remain protected. Current KPI operation is getSharedGetKpiStatistics (fetchKPIdata), not the legacy getKPIDataOld chain.
- Proposal listing is now cards, status sidebar, compact inside-labelled filters, actual lookup operations, Proposal/Sub/Outline/Extension query types, status/risk chips, source-mapped applicant/assignee/activity/type/updated/tags fields and conditional metadata/date/value formatting. Hidden optional fields remain removed from server DTOs. Existing search/filters/sort/page/reset/history/cancellation/retry behavior is retained.
- First Proposal module slice: navigable **read-only Summary** at /proposals/[type]/[id], plus matching protected read API. Numeric path parameters are allowlisted, object roles fetched with p_obj_id/p_obj_type before the summary API, explicit proposals-summary read grant required, returned record ID/type cross-checked. Only mapped resource-visible fields are displayed; no raw ACL/lock/token/private payload sent to clients. No lock/save/approval/delete/ERP operations added by this slice.
- Tests cover real library configuration with fake metadata transport, metadata substitution/capability rejection, retry, unsafe record paths, record identity/field visibility, missing object/session access, announcement XSS handling and browser journeys through Summary/announcements/dashboard tabs.

### Remaining parity work — do not mark complete

- Production/cloud Next.js IDCS→ORDS login still needs dedicated registration, approved claim/scopes/client method/callbacks and independent service trust. The user confirmed local IDCS is unavailable and authorized a separate DEV browser-session bridge. Real local Oracle validation and Home/Proposal listing reads now work; this is not proof of a Next.js IDCS token exchange or Proposal persistence.
- Shell Help/notifications/preferences/accessibility interactions, announcement preferences and source-matched desktop drawer reflow need parity work. Current drawer is modal at all widths. Sanitized rich text preserves basic formatting/links but strips arbitrary inline styles/images; expand only through an approved safe rich-text policy.
- Home calendars, complete insights/chart types/legends/tooltips/drilldowns, opportunities/notifications/dynamic charts and every customer configuration still need migration. Queue ages are passed from backend, but full deadline/overdue styling and global date/currency configuration reconciliation remain open; current attention backgrounds are a visual foundation, not approved date-state parity.
- Listing still uses native select/date controls, explicit Search/Apply and page navigation. Searchable paged LOV behavior, category radios, exact automatic filter timing, advanced-query end drawer, source load-more-on-scroll, count semantics and all status/category/customer variants remain incomplete. Current lookup services should not be treated as proof of complete large-LOV paging parity.
- Summary is an initial resource-aware read view; sponsors/investigators/deadlines/custom attributes/full source grouping and record header/actions/tab coverage need expansion. Summary edit/create/save/cancel, locking/finalization, Budget/Pricing/versions/periods, dynamic forms/compliance, attachments, approvals/delegation/history and recycle/restore remain queued in the agreed plan. No dummy buttons/tabs stand in for those workflows.
- Live mutation acceptance requires designated nonproduction records/workflow actors and a side-effect/reset policy. No live proposal writes or external approvals/OIC handoffs performed.

### Evidence

Typecheck, lint, production build, 111 unit/integration tests and six Chromium browser journeys passed after the DEV connection changes. A standalone artifact scan checked 1,603 files and found zero private capture paths/token bytes. The browser journeys use labelled isolated fixtures, not real Oracle data; real library configuration is exercised with a fake metadata boundary, not a real token exchange. Latest tests include direct Summary API/login boundary, keyboard drawer/tab behavior, filtered card counts/back/reload, stale-response/failure recovery, mobile token/cache checks and logout.

Screenshots inspected: test-results/proposals-desktop.png, home-mobile.png, proposal-summary.png. VBCS references: .playwright-mcp/parity-home.png and parity-proposals-loaded.png. Different account/data mean these are visual review evidence, not a same-data pixel-diff acceptance result.

Next dev cache produced an HMR reload loop; preserving generated `.next/dev` under `/tmp/grantsnow-next-dev-cache-20261014-1220` and recreating it resolved the observed loop. No source was removed. Do not run type generation/build or edit application files concurrently with browser verification in the same build directory.

Legacy remained read-only at b5bdcc31538ea292f2ca4ae4b09125914c2f90a5 with its existing untracked docs/browser evidence. All application changes are local, uncommitted; no cloud/provision/deployment/push.

### Connected DEV findings — 2026-10-14

The explicit loopback-only bridge is documented in dev-browser-session.md. Token capture is private, minimal and owner-only; production rejects this mode. Direct DEV /session/validate succeeds with the GrantsNow token; no VBCS service Authorization/cookies were copied. Local sign-out/renewal do not mutate the shared reference browser session. Tests cover production rejection, unsafe ownership/permissions/size/file type, expired captures, destination mismatch, token rotation and business errors.

Real Next.js Home and Proposal listing were inspected with the authenticated DEV identity. Listing returned total_count=1415 at inspection (not a hardcoded metric), hasMore string flags and nullable currency. Source resource defaults merge with API overrides, as shell-page.js does; explicit hidden fields remain hidden. Current defaults are derived from legacy strings.js at the recorded commit. Global currency/date/decimal configuration is loaded through getPre_award_costingGetGlobalVar; currency fallback is wired, full date/decimal consumer parity remains pending. Own organization defaults match Home source. KPI configuration IDs are uppercase while response IDs are lowercase; mapping reconciles them. Null statistics labels represent empty categories and no longer invalidate the chart. Some live statistic operations still fail/timeout and surface independent errors; do not claim every widget contract is live verified.

Home has no invented home read grant: it is an authenticated context page. Every queue/statistic requires its real module grant, configured visibility and permitted organization. Missing/invalid identity/module configuration still fails closed. Read-only Summary retains explicit object read authorization. Live Proposal writes have not been tested.

### 2026-10-14 — visual comparison iterations

User requested repeated comparison until exact VBCS appearance/behavior. Compared authenticated source and local app at 1800×1043 CSS pixels with the same account/DEV records. This pass is substantial alignment, not final exact-parity acceptance. Reference evidence: reference-home-settled.png and reference-proposals-current.png in .playwright-mcp. Home pass-two and Proposal final-pass images were visually inspected.

Home changed from the extra full-page filter toolbar to source organization-heading selection and Insights-only date filters. Matched header/announcement height, 36px desktop gutters, KPI geometry, compact row heights/metadata and trailing dates; source queue titles and lookup-resolved deadline types. Deadline/pending creation dates now determine server-mapped overdue state using legacy truncated-day semantics. Removed redundant pagination for finite queues; list panels scroll within 300px. Added list/calendar switch, month navigation and the same authorized rows/events; a partial-result message appears if hasMore is true. Calendar is functional but not exact calendar-component parity. Announcement sanitizer preserves bounded font sizes/weights and literal text/background colors; scripts/events/layout/external CSS assets remain rejected. DEV marker remains visible at the bottom without shifting the application header.

Proposals: source category radios, empty inside-label fields, refined card heights/chips/metadata/tag spacing, loaded/API count below a scrolling list. Scroll fetches successive real API pages, preserves existing rows on append errors, offers retry and cancels old append requests on query changes. Text filters commit on blur/Enter and select filters on selection; URL parsing/back/reset still applies. Explicit Enter handling avoids the HTML multi-field implicit-submit limitation after removing Search/Apply buttons. Advanced Query currently exposes the implemented sort controls, not the full source advanced-query expression builder. Native LOVs remain different from searchable paged VBCS controls.

Validation after changes: 112 unit/integration tests, seven Chromium journeys, typecheck/lint/production build passed. Journeys now cover calendar toggling/month navigation and scroll append failure/retry/filter reset in addition to existing boundaries/history/stale responses. Live session expired while comparing and was privately refreshed through the authenticated VBCS login response; subsequent real local listing reads succeeded. Intermittent Oracle validation timeouts also occurred and surfaced the error boundary rather than fake/empty data.

Remaining obvious differences: Home Opportunities/Notifications/Dynamic Charts, full source charts/calendar layouts, header Help/notification controls, desktop drawer reflow, searchable LOVs/full advanced query and Proposal create/recycle/share/copy/delete workflow controls. No fake action buttons were added to simulate them. Further comparison is required; do not state screens are exact or full Proposal module is complete.

Final refinement in this pass: empty fields now retain semantic controls with centered floating hints, category radios and implicit form Enter are tested. Listing scroll loading/reset/retry and blur/select/Enter commits passed all seven browser journeys. Verified CKEditor text/highlight classes are allowlisted and their source colors/sizes reproduced (including text-tiny 0.7em and marker-green #62f962); arbitrary classes stay stripped. Final unit count is 113 after the additional class sanitizer test. The production build/typecheck/lint passed again. No captured token in the standalone artifact scan.

### Repository snapshot prepared for commit — 2026-10-14

The current source also contains initial Opportunity finder, register, analytics and EOI read routes. The finder maps a validated, authorized Oracle page to allowlisted card fields; EOI detail tabs require record scope and strip private attachment locations. These routes are implementation slices, not full Opportunity/EOI parity or authorization for mutations. The fixture suite now contains 131 unit/integration tests and eight Playwright journeys. Typecheck, lint, unit/integration tests and production build passed with Node 24. An existing Next dev server held this worktree's `.next` directory, so Playwright ran in an isolated local checkout with its own installed dependencies: all eight fixture Chromium journeys passed. This is fixture evidence, not live IDCS or Oracle acceptance.

### Current dashboard/loader increment — supersedes earlier missing-tab notes

See [dashboard-parity.md](dashboard-parity.md) and [home-coverage.md](home-coverage.md). Original sidebar artwork/desktop reflow, geometric route/component skeletons, all five configured dashboard tabs and fifteen supported source Insights preferences are now implemented. Insights uses source panel order/chart types, full-width scatter and paired panels, measured colours, multi-select date filters, expansion, complete-result paging and shared modular ECharts rendering. Notification/featured/dynamic read views are connected to verified contracts. Dynamic dimension saving is implemented and fixture-tested, with no live preference write. Remaining opportunity mutations, chart drill reconciliation, unbuilt navigation/header controls and exact calendar/pixel parity are explicitly outstanding.

Current validation: 152 unit/integration checks and 11 fixture browser journeys passed; TypeScript/lint and production build are recorded in § 3. Live KPI/Insights/notifications were observed. Funding Opportunity Status returns Oracle HTTP 555; unrelated widget settings do not constitute a funding-efficiency gauge. No live Next.js IDCS login was claimed.

### Opportunities and EOI increment — 2026-10-22

The finder, the EOI list, the EOI record and the finder's dialogs were ported from GN-Angular, then measured against the live DEV app and adjusted. The live numbers are in the GrantsNow KB, `GrantsNow-Opportunities.md` § _Live DEV measurements (2026-10-22)_. The rules this work added are in [grantsnow-foundations.md](grantsnow-foundations.md) § _Engineering rules_: RB items show only on `'Y'`, every element has a unique short id, every interaction and update animates, listing filters share one look, `DateInput` uses the global format, and the app runs in parallel without races.

- **Shared UI:**
  - `Select` and `MultiSelect` are type-in comboboxes: matches in bold, Downshift comboboxes in fixed overlays placed by Floating UI (`useDropdownPanel`), lists windowed by TanStack Virtual, live's "more results" cap, detail lines.
  - `InsideField` is the Redwood inside-label box, used by the EOI list drawer and the Share dialog.
  - Also added: `FilterSection` and its helpers, `DateInput`, `usePresence` (leave animations) and `highlight`.
- **Finder:** GN-Angular's panel toggle and Advanced filter, collapsible sections that animate, and the live Status checkbox glyph.
- **EOI list:** live's navigation-list statuses, inside-label fields, card rows and centred carets.
- **Share dialog:** live's flow: select-singles, a chip multi-select for people with detail lines, and changing Send To clears the selection.
- **Convert dialog:** searchable PI, Org Unit and Primary Funder; the date picker is anchored under its field.
- **Performance:** independent server reads run in parallel and session-keyed memos hold reference data; setups are prefetched on hover; cards and the funder tree are memoised.
  - Finder page: 18–27 s → 6.2 s.
  - Convert dialog: 29–34 s → 10.6 s cold, 3.0 s warm.
  - Main-thread block per finder click: 120–160 ms → 0.

**Evidence:** 561 unit/integration tests and 12 fixture Chromium journeys passed, with typecheck and lint. The finder filters, EOI list filters and every finder dialog were exercised in the browser against live DEV data (mocked: none). No live write was made; dialogs were closed without Send, Save or Create.

**Outstanding:**

- Escape while Chrome's native date picker is open also closes the enclosing dialog.
- Not yet browser-tested: the Comments dialog, the deadline-warning dialog, the Bookmarked / Shared tabs, resizing the filter panel and narrow screens.
- The Advanced filter's values are not written to the URL.
- Proposals and Contracts belong to another owner and were not changed.

**Later the same day: caching and the app store.**

- **Server:** the reference data the VBCS app holds app-wide is now held per session through `cachedRead` / `forgetRead` (`src/server/cache/reads.ts`), and every matching save clears it. Covered: user preferences, person status, new flags, notifications, announcements and EOI record roles. The full VBCS inventory is in the GrantsNow KB, `GrantsNow-Shared-Features.md` § _App-level data the VBCS app holds_.
- **Client:** an app store (`src/lib/store/app-store.tsx`, `useReducer` + Context) backs `useRemote` and the dialog reads. It shares one request per key and keeps the latest answer.
- **Setup:** `.env.example` carries every DEV URL, so a teammate supplies only the credentials (see the README).
- **Checks:** 563 unit/integration tests, typecheck and lint passed.

### EOI record fragments — 2026-10-23

The remaining Opportunities work is built as shared, host-agnostic panels, with the EOI record as the first host. Each one's legacy evidence is in the code comments and the GN-Rebuild KB.

- **Built:**
  - Comments (with @mentions; edit and delete limited to the user's own comments) and the Audit trail (`src/features/record/objects/`, `src/server/record/objects/`).
  - Attachments: folders, upload, download, delete, preview and links (`src/features/record/attachments/`, `src/server/record/attachments/attachments.ts`).
  - Approval workflow: stages, approvers, the Add Stage dialog, Generate/Submit/Withdraw and the approver's verdicts (`src/features/record/approvals/`, `src/server/record/approvals/`).
  - History (Add Status, Abandon) and Delegation (`src/features/record/objects/object-*.tsx`).
  - Object attributes on the Application tab, behind `labels.show-attributes`, which is seeded `N`.
  - FX rates, built but not mounted (Proposals belongs to Easwar).
  - Shell audit fixes and the app-wide KB improvements.
- **Write gates:** every write is checked on the server against the page's role, its lock, the RB row, and the record's own rows.
- **Approval actor:** `action_by` is the session's verified username. DEV browser sessions carry none, because `session/validate` returns no username, so approval actions can't be tested through the DEV bridge.
- **Dynamic-form defects from the live run, fixed:**
  - The `*` in labels wrapped onto its own line.
  - Checkbox and radio groups had no id.
  - Create could be pressed before the form loaded. It now waits, and `check()` fails closed until the form is ready, so no request is inserted without its answers.
  - Validation toasts now auto-close, as legacy's `transient` ones do.
- **Deep links:** a `?comment-id=` link opens the comments drawer.
- **Decision:** the deadline warning counts calendar days, so it still warns on the closing day, and a configured `0` stays `0`. This supersedes GN-Angular's "fractional days" (KB Audit 2026-10-16 L).

**Dependencies (owner-approved 2026-10-23):** `next` and `eslint-config-next` went to 16.4.2 and `quill` to 2.0.2 for npm advisories; `npm audit --omit=dev` now reports 0.

**Evidence:** 662 unit/integration tests, typecheck, lint, Prettier, the isolated production build and 13 fixture Chromium journeys all pass. The new journey covers:

- Create waits for the form;
- the validation toast closes on its own;
- create, then Finalize refused with unsaved changes;
- Save as draft, then Finalize on and off, with the Workflow tab appearing and disappearing;
- an attachment upload and delete.

Its fixtures are in `src/test-support/eoi-writes.ts`. That lock store is held on `globalThis`, because the route handler and the record layout can load separate module instances. The fixture user now carries a `legal_id`, as live users do.

**Mocks only:** none of these panels has been run against live DEV yet.

**Owner decisions (2026-10-23):** attachments change only in `DRFT` or `REWORK` (`ATTACHMENT_STATUSES`; the server refuses anything else, and the panel hides its edit controls). Attributes persistence waits on the backend; the frontend stands as built.

**Live DEV run on application 3954 (AOI_514), 2026-10-23:**

- Last session's Create answers persisted.
- Edit, then Save as Draft, saved and re-read the edited answer.
- Finalize was refused with unsaved changes; no lock request was sent.
- Finalize on: lock 200, the Workflow tab appeared, Edit was disabled, and the state persisted across a reload.
- Finalize off: 200, Workflow hidden, Edit enabled again.
- Attachments upload was refused by OIC with **401**: the `.env.local` OIC credentials were rejected. Nothing was recorded, because storage is written first.
- Not testable on this record: the Dynamic Form tabs (none on 3954) and the Workflow actions (DEV browser sessions have no username).
- **Network:** connects to the ORDS host intermittently stall from this machine after idle (up to 10 s on connect, 48 s on one validate). DNS was measured fast, and each IP connects in about 0.15 s once warm. Failed calls were all reads before any write, so no write was half-applied. Retrying idempotent reads on a connect timeout is left to the owner, as a transport-framework decision.
- **The dev 503 pairs are not server responses:** the server logged only 200s for both routes. They are StrictMode-aborted first fetches.

**Oracle transport (owner-approved 2026-10-23):**

- **What happens:** the VBCS app reaches ORDS through VB's proxy inside Oracle's cloud. This app calls ORDS from the machine it runs on, which occasionally stalls new connections after idle.
- **Why the app felt it:** Node's default fetch drops idle connections after 4 s, so most clicks needed new ones.
- **Change:** `src/server/oracle/connection.ts` now fetches through one `undici` pool. `undici` 8.12.3 is now a pinned direct dependency; it was already in the lockfile through jsdom. The pool keeps idle connections for 30 s (60 s max, capped by ORDS's own Keep-Alive hint).
- **Retry rule:** a read whose connection timed out is retried once, inside the same deadline. Writes are never re-sent.
- **Live soak:** 12 of 12 requests passed with gaps of 0–120 s, with no connect timeouts. The retry path itself is proven by unit tests only, because no stall occurred during the soak.
- **Debugging:** `npm run dev:inspect` shows these calls in Node DevTools' Network tab (see the README).
- **Delegation:** stays as legacy (owner).
- **OIC:** after the owner updated the credentials, upload, preview read-back and delete all passed live.

**Approvals on the DEV token bridge (owner-approved 2026-10-23):**

- **Live VBCS:** VBCS injects the IDCS user; its `userName` is the work email (`email` is the same). Legacy sends that as `action_by`.
- **Rebuild:** on the bridge only, `src/server/record/approvals/actor.ts` takes the email of the person Oracle validated the token for, from `getPersonListAll`. With OIDC, the verified username is used. Not found, no email, or outside development means no actor, and the action is refused.
- **Verified live:** Generate Approval Route on 3954 returned 200; one stage was built (Approval From Division Head). Submit was not run, because it notifies real approvers.

**Person lists (legacy defect fixed):**

- **Contract:** `getPersonListAll` / `getPersonList` answer 25 rows with `hasMore: "true"` (a string) unless sent `p_offset` / `p_limit`. Legacy sends neither, so it stops at 25 people.
- **Fix:** `referenceRead` now pages those two lists (500 rows a page, at most 20 pages, then refuses).
- **On DEV:** the list has exactly 25 people (`p_limit=500` gives 25 with `hasMore: "false"`), so nothing was missing there; the fix matters wherever there are more.
- **Still single-page:** `src/server/modules/account/service.ts` (the proxy picker) and Proposals' `lookups.ts` (Easwar's) call `getPersonList` directly.

**Outstanding:**

- Owner: approve a live Submit for Approval on 3954, which notifies the DEV approvers.
- The live files run (upload, download, delete) once OIC accepts the credentials.
- Delete test application 3954 on DEV when finished.

### API layer, catalogues, fallback translations and restructure — 2026-10-23

- **API layer** ([api-layer.md](api-layer.md)):
  - Every Oracle call goes through `server/oracle/api` functions. Identity comes from the session, reads are held by their parameters (per request, or per session for reference data), writes clear what they change, and reference lists the backend pages are read whole.
  - The browser goes through `lib/api`, using `useApi` and `usePagedApi`, the latter with `total`, `start` and `initial`.
  - Routes go through `route()`.
  - The connection keeps one undici pool (30 s keep-alive) and retries a read once when its connect times out; it never retries a write.
- **Catalogues** (`scripts/oracle-catalogue.mjs`):
  - All 356 legacy ORDS operations and 10 OIC flows are allowlisted, each with a raw function.
  - 129 of the ORDS operations are writes, all behind the writes gate. Only the 4 reviewed GETs count as writes; `generatePrintProposalReport` is a read (it returns the report file, owner 2026-10-23).
  - The OIC UNIT4 flow has no path in the legacy contract, so it refuses to call.
  - The session token never goes to OIC unless a flow requires it; none does.
- **Fallback translations** (`scripts/resource-seed.mjs`):
  - The seed is now legacy's runtime `strings.js`: 11 bundles and 8,110 rows, with descriptions, mandatory flags and preferences.
  - Before, it had 6 bundles and 4,779 rows, and its visibility differed on 116 keys.
  - Backend rows merge over it field by field, as legacy's `_.merge` does.
  - Legacy's 11 mis-nested `dashboard.aria-labels.*` groups are skipped.
- **Restructure** ([architecture.md](architecture.md)):
  - `server/{oracle,oic,http,identity,platform,modules,record}`
  - `features/{modules,record}`
  - `components/dialog`
  - `lib/{api,store,hooks}`
  - `shared/`
  - The migration shims, `use-remote` and the old per-feature fetch helpers are gone. `tests/unit/layering.test.ts` enforces the layering rules.
- **Docs:** the four status files are merged into this one, and the README has a docs index.
- **Evidence:**
  - Typecheck and lint have 0 problems. Prettier is clean, apart from the input-only migration spec.
  - 702 unit and integration tests, the isolated production build and 13 fixture Chromium journeys pass.
  - A live DEV smoke test after the restructure passed: Home, the finder (25 of 4784), the EOI record's History tab, and the Comments drawer opened from `?comment-id`.
  - Earlier in the day: a comment was posted live through the new layer, and Generate Approval Route returned 200 live.

### Libraries, caching holds, searchable dropdowns, Motion and focus rings — 2026-10-23

- **Libraries** (owner-approved, pinned): lodash (seed merge), moment (dates, durations, deadlines), TanStack Query (browser store under `useApi` / `usePagedApi`), lru-cache (server holds), Downshift with TanStack Virtual and Floating UI (dropdowns), Motion (popups, toasts, record drawer, filter sections), undici (connection pool).
- **Caching:** what the live app caches, plus the owner-approved holds listed in [api-layer.md](api-layer.md). Home figures are served stale for up to 10 minutes while one refresh runs. Reads inside a write request are always fresh.
- **Dropdowns:** every dropdown is the searchable `Select` / `MultiSelect`, including Proposals' filters; `src` has no native `<select>`.
- **Focus rings:** shown only after keyboard navigation (`components/layout/input-modality.tsx`); a click never leaves an outline, border ring or switch ring, fields included (owner).
- **Defects found by the e2e journeys and fixed:**
  - The server cache was module-level, and Next loads route handlers and pages as separate module instances, so a write's invalidation never reached the page (Finalize succeeded; the page showed the old lock). It now lives on `globalThis`; `tests/unit/oracle-cache.test.ts` covers it.
  - Retry after a failed next page re-read only the held pages (`refetch`); it now asks for the failed page again.
- **Follow-ups the owner approved the same day:**
  - The finder moved onto `usePagedApi`: Others, Bookmarked and Shared are held per tab and filters, so switching back shows the list at once (it used to blank and reload). Bookmark and notes saves are patched into every held list.
  - A filter or tab change keeps the previous rows on screen, dimmed and inert, until the new ones arrive (EOI list, finder). Background refreshes never show a skeleton or dim the list (finder, EOI list, Home tabs).
  - A write drops the reads it changes whether it succeeds or fails (a timed-out write may have committed).
  - Proposals reads its lookups, people and roles through the shared `lookups` / `people` / `roles` functions: they are held per session and the people list is read whole (it stopped at 25).
  - `generatePrintProposalReport` is a read (it returns the report file).
  - No focus ring on click anywhere, fields included; keyboard keeps every ring.
- **Evidence:** typecheck clean; lint 0 errors (one React Compiler notice on the virtualised list); Prettier clean apart from the input-only migration spec; 711 unit and integration tests, the isolated production build and all 13 fixture Chromium journeys pass. On live DEV, switching between Others and Bookmarked shows each held list within 30 ms, with no skeleton. Live DEV, dev server: EOI Summary 449 ms cold, 357 ms held; Home 485 ms then 317 ms; the notifications read 2,088 ms cold, 35 ms held. No pre-change baseline was measured.

## 2. Approved plan (2026-10-14)

## GrantsNow VBCS → Next.js parity implementation plan

Prepared 2026-10-14 from the authenticated VBCS application, current legacy source and existing Next.js implementation. Goal: the same appearance, interaction and business/API behavior for IDCS authentication, Home/dashboard, Proposal listing and the Proposal module. This is a fidelity migration, not a redesign. All implementation stays in this Superset worktree.

### Evidence and current position

- Legacy source inspected read-only: `/Users/easwar/Developer/GrantsNow`, HEAD `b5bdcc31538ea292f2ca4ae4b09125914c2f90a5`. Do not switch/reset/update that checkout. Earlier foundation mapping used an older commit, so re-diff relevant files before implementation.
- Authenticated reference: `vbshare_621/webApps/app`, Home and Proposal listing observed. The deployed preview and current checkout are not yet proven identical; capture served source/build identity before declaring parity.
- Existing Next.js foundation has OIDC/session adapters, protected services, explicit fixtures, Home adapters, URL-query listing and prior passing tests. Those checks demonstrate foundation behavior, not VBCS fidelity or live Next.js IDCS/ORDS integration.
- Current screens require substantial changes: dashboard arrangement/visual language differs; Proposal listing uses a table instead of the observed cards/side filters; lookup/resource/field coverage and full module workflows are incomplete.
- This request expands the earlier read-only increment to a PLAN for the full Proposal module. Application implementation and live mutation testing are not performed in this planning turn. Live inspection here used navigation and opening/closing the advanced-query drawer only; no proposal saves, approvals, clones, deletes or ERP submissions.
- Evidence: `.playwright-mcp/parity-home.png` and `parity-proposals-loaded.png`. The earlier `parity-proposals.png` shows loading skeletons and is not the loaded-state visual baseline. Screenshots are local reference evidence, not public/fixture seed data.

### Observed parity requirements

| Area           | Verified live/source evidence                                                                                                                          | Required change                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme          | Header `rgb(49,83,87)` / `#315357`; body `#fbf9f8`; text `#161513`; Oracle Sans computed font, 12px body, 21px organization heading; 3px button radius | Derive tokens from live computed styles plus app.css/shell.css/redwood-overrides.css and active customer resources; retain logo/icons/compact density |
| Shell          | Navigation drawer, GrantsNow logo, Help, notification badge, named user dropdown; resource/module-aware navigation                                     | Rebuild matching shell and supported interactions; mark cross-module dependencies explicitly rather than fake functionality                           |
| Home           | Announcements carousel/collapse, organization selector, four KPI strips; Need Attention/Insights/Opportunities/Notifications/Dynamic Charts selectors  | Reproduce observed layout and configured sections; map each enabled item and interaction to its actual service/configuration                          |
| Attention      | Full-width dense record rows, metadata separators, overdue pink background/red date/age, List View/Calendar View tabs                                  | Replace generic dashboard cards; preserve due/pending calculations and complete event/paging/filter consistency                                       |
| Listing        | Status sidebar, category radios, inside-labelled lookup controls, collapsible filter panel, advanced-query end drawer                                  | Replace toolbar/table layout with faithful sidebar/cards; reproduce filter application timing and query semantics                                     |
| Records        | Reference/type icon, status/risk chips, title, investigator/applicant/assignee/department/sponsor/activity/type/date/value/tag metadata, action strip  | Expand allowlisted DTOs from verified fields; preserve resource visibility, currency/masking and status-dependent actions                             |
| Loading/counts | Initial skeletons; loaded `10 of 1415` footer; loadMoreOnScroll source                                                                                 | Trace loaded/filtered/global count semantics and incremental load behavior; do not simply rename page row count as total                              |
| Module         | Source-defined tabs, dynamic forms, budget versions, locking/finalization and status/access-dependent actions                                          | Implement shared record context and server policies before enabling edits/workflow                                                                    |

Only the observed account/theme is a live baseline so far. Other roles, dark theme, small widths and Proposal/Outline/Sub/Extension variants require separate reference captures.

### Delivery order and gates

#### Phase 0 — Freeze the parity specification

1. Build a screen/state register from the existing migration artifacts, limited to the requested scope, not all 111 application screens.
2. For each screen record: source HTML/JSON/JS/action chains/fragments; resource keys; endpoint/method/headers/query/body/response/error; permissions/status/finalization/lock rules; visible states; screenshot and keyboard behavior.
3. Capture stable desktop/narrow-width reference screenshots, loading/empty/error states, menus, dropdowns, drawer/modal dimensions, focus/escape/tab behavior, formatting and animation. Use sanitized fixtures for repeatable visual tests; do not copy real user/session data into fixtures.
4. Compare served VBCS build with the checkout, then flag discrepancies. Product owner chooses authoritative behavior where branches differ; do not unknowingly port an unrelated legacy ticket.
5. Audit reusable assets/font/icon licensing and availability in source. Run a small feasibility spike for exact lookup/calendar/chart behavior: prefer React components that reproduce the observed contract; use isolated Oracle JET wrappers only if official supported integration provides materially better parity. Do not install a competing UI stack speculatively.

Gate: every requested screen/action has a traceable entry; unknowns are explicit. No styling redesign is accepted as parity.

#### Phase 1 — Real IDCS authentication + GrantsNow session

A public tenant metadata read succeeded HTTP 200 on 2026-10-14. Discovery location:
`https://idcs-15d925c7215d453383570f3a762db1fc.identity.oraclecloud.com/.well-known/openid-configuration`.
Advertised issuer: `https://identity.oraclecloud.com/`. Advertised capabilities: authorization code, S256, RS256; client_secret_basic/client_secret_post/private_key_jwt/none. End-session is advertised. These capabilities do not prove this client's registration/scopes/logout contract.

The existing adapter calls issuer-based discovery using one URL and compares advertised issuer to it. Using the tenant host as issuer will fail; using the advertised issuer alone does not locate tenant-specific metadata. Fix this before live login:

1. Configure **approved expected issuer** separately from **approved tenant discovery location**. Retrieve metadata only from the fixed approved HTTPS tenant URL, validate exact issuer and allowlisted tenant endpoint origins, then construct the library configuration using the validated metadata. Do not disable issuer/audience/signature/state/nonce checks or accept arbitrary discovery URLs.
2. Register a dedicated confidential Next.js web application with the same IDCS identity domain. Administrator confirms client authentication method, permitted scopes, S256 and approved username claim. Retain openid-client for code exchange/JWKS/claim validation; select its documented ClientAuth mechanism to match registration.
3. Register local callback `http://127.0.0.1:3000/api/auth/callback`, fixed logout return `http://127.0.0.1:3000/login`, and later chosen Azure HTTPS equivalents. Never assume the existing VBCS client permits them.
4. Map a library-verified identity claim exactly to GrantsNow username. Do not infer it from the displayed full name or reuse a browser DB token/cookie.
5. Resolve how Next.js replaces the VBCS service proxy's authentication. Keep the existing Oracle database/ORDS/OIC destinations, paths, headers and bodies; add independent approved server service authorization. VBCS credential identifiers are not credentials.
6. Bootstrap `/session/login`, then validate/extend/logout using the separate DB token. Capture sanitized actual success/business-error/expiry/access contracts and reconcile schemas. Unknown user or HTTP-200 business error must not create a session.
7. Retain protected HttpOnly cookie, no client tokens, private/no-store data, exact-Origin POST actions and page/API authorization. Confirm backend revocation, validate nonrotation and concurrent extend behavior; approve shared session/lock storage only if required, with provisioning separate.
8. Verify supported IDCS logout behavior including whether token-free client_id logout works. Distinguish local, backend and identity-provider cleanup failures.

Gate: **Next.js itself** completes real DEV login→bootstrap→protected read→renew→logout with allowed/denied/unknown accounts, correct trusted username and private payloads. Existing VBCS login and fixture tests do not satisfy this gate.

Reference: official openid-client discovery docs note direct discovery-document URLs skip automatic metadata issuer validation; therefore explicit expected-issuer validation is required for this tenant arrangement. Use documented Configuration/ClientAuth and signature checks, not custom OIDC cryptography.

#### Phase 2 — Shell/component parity and dashboard

1. Build reusable parity primitives: compact buttons/icon buttons, inside-labelled text/select/LOV controls, date picker, multi-select tags, status/risk chips, record metadata rows, drawers/dialogs, validation summaries, toasts, tabs, skeletons, scrolling/paging and accessible focus behavior.
2. Rebuild header/logo/navigation/user menu and active-route behavior from shell-page/fragments; integrate live session/resources. Preserve permission-aware visibility and direct-request checks.
3. Match Home organization selection, announcements behavior, KPI strip and dashboard section navigation. Trace current KPI chains `load_KPI_from_api.json` and `fetchKPIdata.js`; identified operations include getSharedBidSuccessRate, getSharedAwardYOY, getSharedVarianceCostAward, getSharedVariancePriceAward and getSharedGetKpiStatistics. Reconcile which chain/config powers each live display before using values or formulas.
4. Rework existing nine attention adapters into matching rows and implement their verified fields/date/status rules. Add calendar behavior with complete event consistency across filters/loading; no partial calendar presented as complete.
5. Reproduce chart type, series, palette, legends, tooltips, date filters and drill-down semantics. Existing eight adapters are a starting point, not complete insight parity. Map dynamic charts/opportunities/notifications and their Home-only interactions separately from rebuilding their destination modules.
6. Treat real read APIs/business errors independently per widget and compare with VBCS using known DEV records.

Gate: same enabled Home sections, labels, values and permitted drill-downs; reviewed screenshot differences at identical viewport/theme/data; keyboard and failure states verified. Out-of-scope destination modules remain explicitly tracked dependencies.

#### Phase 3 — Proposal listing parity

1. Keep `apps/getPre_awardGetProposalsList` GET `/pre_award/getProposalsList/`; reconcile current provider/fetch chains/transforms, ORDS q expressions, sort, loadMoreOnScroll and totals. Preserve API semantics while URL state supports reload/back/forward.
2. Render the observed record cards rather than a substitute table. Match reference/type, status/risk, title, metadata order/wrap/separators, dates/value/tags, hover/focus and action placement.
3. Build left status tabs and category selectors covering actual Proposal/Sub-Proposal/Outline/Extension codes. Existing Next.js two-type enum is insufficient; verify source codes before expanding it.
4. Implement real investigator/department/sponsor/assignee/activity/proposal-type/tag lookup selectors, typed ID/value binding, date controls and clear behavior. Replace code-entry placeholders with verified LOV contracts.
5. Implement the advanced-query **end drawer** (not modal): source allowlisted attributes/operators/types, add/edit/remove condition behavior and exact legacy transform; never pass unrestricted user expressions to Oracle.
6. Keep row reads authorized; preserve resource-hidden fields and object/action scopes. Show loading/empty/failed/session-expired states distinctly; latest-request protection applies during filter resets and incremental loads.
7. Implement listing action surfaces when their Phase 4 workflows are functional: create Grant App/Outline, link/share, clone, delete and recycle/restore. Do not show inert controls as completed parity.

Gate: identical record set/ordering/visible fields/counts for a matrix of filters and categories; same observable interaction and visual layout; no unauthorized direct API reads/actions; scroll/filter/back/reload and cancellation tested.

#### Phase 4 — Full Proposal module in vertical slices

First implement record context: `/proposals/[type]/[id]`, header/status/actions, configured tab names/order, object permissions, editable statuses, finalization/locks, budget selection and unsaved-change navigation. Recheck summary operation `apps/getProposalProposal_id`; lock/finalization source includes `apps/postProposalInsertModuleLock2`. Permission flags must be checked server-side as well as reflected in UI. Legacy getTabs permits tabs when access is absent; reconcile this with explicit fail-closed authorization rather than copying the exception blindly.

| Slice                               | Source-backed scope                                                                                                                                                                     | Acceptance focus                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4A Core lifecycle + Summary         | Proposal/Outline creation, summary fields/LOVs/investigators/sponsors/deadlines/tags, edit/save/cancel, links/share/clone, type conversion and Sub/Extension flows where source permits | Required/hidden/readonly fields, approved status transitions, save failure retention, exact payload, fresh-read persistence                            |
| 4B Budget + Pricing                 | Cost lines/periods, indirects, cost models/rates/currency, versions/create/clone/delete, research partners, in-kind, allocation for credit, FEC summary, pricing                        | Exact financial precision/rounding/period/currency/version/finalization rules; backend remains calculation authority where applicable                  |
| 4C Dynamic forms + compliance       | Five configured dynamic-form flows; ethics, due diligence, sponsor due diligence; metadata-driven labels/validation/visibility/attachments                                              | Customer-specific form configuration and persisted answers; don't replace with hardcoded sample forms                                                  |
| 4D Documents + related records      | Attachments/upload/download/preview; linked Contracts/Awards views                                                                                                                      | Permissions, allowed files/size, preview/download behavior, relation navigation; related modules are dependencies, not automatically rebuilt wholesale |
| 4E Approval + completion            | Approval chains/actions, delegation, history/audit, rework/rejection/finalization, sponsor/ERP handoff as source allows                                                                 | Correct workflow actor/stage/status, locking/concurrency, backend error handling and side-effect boundaries                                            |
| 4F Recycle/restore + parity closure | Soft-delete/recycle/restore, remaining lifecycle actions and every registered enabled tab/state                                                                                         | Confirm recovery semantics/permissions, no premature irreversible actions, complete matrix/UAT                                                         |

Source getTabs enumerates 21 flows: Summary; Budget; Pricing; Dynamic Forms 1–5; Allocation for Credit; Budget Research Partner; In-kind Contribution; FEC Summary; Ethics; Due Diligence; Sponsor Due Diligence; Contracts; Attachments; Awards; Approvals; History; Delegation. Actual names/visibility are resource/access-driven. These are source-verified inventory entries, not claims that all were inspected live today.

For each slice: trace chains/contracts → capture reference behavior → implement server service/schema/policy → implement matching UI → failure-mode tests → disposable DEV persistence tests → visual/business UAT. Mutation testing needs a designated nonproduction dataset and agreed reset procedure; no live destructive/approval/ERP effects are authorized merely by browser access.

### API and implementation boundaries

- Reuse existing Oracle/ORDS/OIC APIs; no replacement backend or guessed endpoints. Maintain a contract register including operation ID, configured destination, proxy/auth needs, all inputs/outputs/business errors, client DTO and source evidence.
- Next server handles auth/secrets/tokens/Oracle transport. Browser receives minimal display data and verified action capabilities. Initial Server Component reads call server services directly; browser interactions use protected handlers sharing those services.
- Retain the current folder conventions; expand Proposal subfeatures around actual responsibilities. Separate identity/session, server query state and local draft/dialog state. Don't recreate VBCS global variables as one React singleton.
- Request cancellation, save single-flight behavior, stale-response protection, backend validation errors, navigation guards and lock cleanup are implementation requirements, not visual polish.
- Accessibility should preserve familiar keyboard behavior while correcting accidental defects; document intentional deviations instead of silently changing business behavior or reproducing unsafe authorization.
- Azure portable Node deployment remains the target. No Vercel-only integration, static export, provisioning or deployment is part of this plan.

### Missing inputs and decisions

1. Dedicated IDCS client ID/secret or approved key mechanism; exact client auth method/scopes; username claim/case mapping; registered callback/logout URLs. Public metadata is now verified, but actual tokens/client compatibility are not.
2. DEV ORDS base/apps destinations and authorized replacement for VBCS proxy credentials/network; confirmation of token expiry, renewal/revocation/row scope and successful response shapes. Supply secrets privately through ignored env/settings.
3. Authoritative served build/branch and target customer resource/theme; allowed/denied accounts and role matrix; configured tab names/visibility.
4. Disposable DEV Proposal/Outline/Sub/Extension records and workflow participants for permitted mutation tests, including attachment and OIC side-effect policy.
5. Review criteria for exact visual parity and explicitly accepted differences, including mobile, dark theme, font/icon licensing and known legacy bugs.

### Completion evidence per phase

Automated type/lint/unit/integration/build checks; real DEV service acceptance when configured; isolated Playwright failure/keyboard/navigation tests; visual screenshot comparison with identical data/theme/viewport and animation settled; reviewed list of deviations. A phase is not complete from fixture screenshots alone. Record coverage and blockers in this file and the existing Obsidian context.

Suggested team ownership for the two UI/two AI developers: UI1 shell/components/Home; UI2 listing/record screens; AI1 identity/session/API/policy contracts; AI2 legacy trace/fixtures/tests/parity register. These are project responsibilities, not agent delegation. Deliver sequential phase gates with coordinated contract/component review.

Official references: [Next authentication](https://nextjs.org/docs/app/guides/authentication), [openid-client discovery](https://github.com/panva/openid-client/blob/main/docs/functions/discovery.md), [library source/docs](https://github.com/panva/openid-client), [Oracle web application authorization](https://docs.oracle.com/en/cloud/paas/identity-cloud/idcsa/ACWebServerAppAuth.html).

## 3. History — first increment

## Foundation validation — historical first increment

**Current state:** see § 1 above. The original table-first UI and read-only scope below are historical; the user approved the broader parity migration.

Date: 2026-10-13. Repository: `/Users/easwar/.superset/worktrees/gratsnow nextjs/faceted-rook-b1710e7e`. The user's explicit current-folder instruction supersedes the prompt's proposed Developer directory. All application files are directly in this worktree; no nested repository, commit, push, deployment or cloud provisioning.

### Implemented

Next.js 16.4 App Router/React 19.3/TypeScript 6, pinned npm lockfile and Node 24 LTS. Library-based generic IDCS OIDC code/PKCE/state/nonce/signature validation, separately protected GrantsNow session bootstrap/validate/renew/logout, encrypted HttpOnly cookie, exact-Origin POST protection, server-only allowlisted Oracle transport, fail-closed permissions and explicit development fixture isolation.

Responsive authenticated Home/Proposals shell, identity/organization/theme, nine configured attention adapters and eight statistics adapters with independent error/retry/loading/paging and scope/filter propagation. Proposal listing has real ORDS query mapping, stable Proposal/Outline identity, configured column visibility, date/value formatting, title/reference/status/organization-related/investigator/date/type/tags filters, sort/paging, URL back/forward/reload/reset, request cancellation/generation protection and safe errors. No unimplemented record actions or dead links.

### Validation evidence

- `npm ci`: passed using Node 24.13.0/npm, without peer-dependency bypass.
- `npm run typecheck`, `npm run lint`: passed.
- `npm test`: 59 tests across four unit/integration files passed. OIDC/Oracle integration boundaries are isolated mocks; cryptographic/live tenant compatibility is not proven by them.
- `npm run build`: passed; auth and personalized page/API routes are dynamic, no personal data prerendered. Build produces a portable standalone Node server and prepared static/public assets.
- Playwright: five full-Chromium journeys passed; independently, five installed-Chrome journeys passed. Covers login boundary/callback rejection/CSRF, Home filters/widget failure/retry/navigation, listing search/filter/reset/paging/back/reload, request failure/recovery/out-of-order results, mobile keyboard/cache/token isolation/renew/logout. Screenshots inspected for responsive layout. Development fixtures only.
- Default headless-shell run initially failed four journeys because Next development hot reload repeatedly reloaded login before any POST. Full Chromium channel resolves this; configured default is now `channel: chromium`. No authentication check was bypassed.
- Production fixture startup: explicitly rejects fixtures; protected server preparation fails and `/api/health` returns 500. Runtime integration checks and production build compilation are distinct.
- Prepared standalone `npm start` without live settings: clear missing `SESSION_PASSWORD` configuration error and health HTTP 500; no fake production fallback.
- `npm audit --omit=dev`: zero runtime findings. Full audit: five high dev-only Next ESLint transitive findings; see security-review.md for exact maintenance limitation.

Legacy inspected initially at `6f1c81f0cc70d11b1ad0f1881e3a2f5db0c3675e`. Another session advanced its HEAD to `329c2de1e5326d492570c2aad0db4808d1df81e6` during this task. A read-only diff confirmed no changes to the shell/Home/listing/API/app-flow/strings paths used here. Existing untracked `.playwright-mcp/` and `docs/` were preserved; this task made no legacy writes.

### Live integration blockers and deferrals

Real IDCS login, tenant metadata/client method/JWKS/logout, actual GrantsNow rows, service-account authorization, response shapes/expiry/renewal concurrency/row scope and customer resource configuration have **not been verified**. Exact owner inputs and live test procedure are in authentication.md; supply secrets privately in ignored settings. Trust gates remain disabled. Cookie replay/revocation and concurrent token rotation require backend confirmation before release.

Calendar event parity, chart-to-list reconciliation, dynamic insights/KPIs, custom theme catalogue/preferences, detail/edit/create/copy/delete/restore, approval actions and other module pages are deferred. See home-coverage.md and api-mapping.md for precise source coverage and limits. Azure hosting preparation is documentation/artifact only.

### Run here

`nvm use 24`, `npm ci`, `npm run dev`; open `http://localhost:3000` and select **Enter fixture workspace**. The ignored local environment is already prepared with a random session key and explicitly labelled synthetic data. For production-like compilation use `FIXTURE_MODE=false npm run build`; running the production server additionally requires complete verified live settings, HTTPS origin and `FIXTURE_MODE=false`.

### Current dashboard/loader increment — 2026-10-14

This section supersedes the historical first-increment coverage and live-data statements above. See dashboard-parity.md for exact limits; full VBCS/application parity is not signed off.

- Implemented VBCS sidebar artwork/reflow, source-colour/icons/tab strip, independent page/record/KPI/chart/table/detail skeletons and reduced-motion/accessibility status.
- All five configured dashboard tabs have working read views. Insights supports fifteen source preferences (fourteen visible source panels in the observed live account), source panel order, chart types/palette, multi-select date filters, complete chart result paging, expansion/data tables and independent failures. Dynamic Charts shares its engine and has protected dimension saving/report links.
- `npm test`: **152 passed** across sixteen unit/integration files.
- `npm run test:e2e`: **11 Chromium fixture journeys passed**, including all tabs, keyboard focus after filter navigation, chart rendering/expansion, multi-date filtering/reset, notification paging/recovery, chart dimension saving/CSRF and delayed skeletons. No real IDCS or live write is implied by these fixture checks.
- `npx tsc --noEmit`: passed. `npm run lint`: passed. `GRANTSNOW_BUILD_CHECK=true DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build`: passed with standalone/static/public assets in .next-check. Personalized pages/APIs remain dynamic.
- Production artifact scan found **zero matches for the captured DEV token**; capture remains ignored with mode 0600. Test scratch copies exclude credentials/captures. Runtime npm audit has no new chart-library finding; the existing five high dev-only Next ESLint transitive findings remain documented in security-review.md, and no major framework downgrade was applied.
- Live DEV KPI, Proposal/financial Insights and notifications were observed through the explicit captured browser session. Oracle Funding Opportunity Status returns **HTTP 555**, independently surfaced with retry. Award statistics completed after about **31 seconds**, so aggregations receive 60 seconds; no repeated automatic retry loop is introduced. The enabled Dynamic Chart returns an empty dataProvider; nonempty rendering and writes were verified only with fixtures. Funding Efficiency filters DASHBOARD_FEI before validating values/targets and does not invent a gauge from unrelated settings.
- Existing read-only legacy checkout remained at `b5bdcc31538ea292f2ca4ae4b09125914c2f90a5`. No legacy edits, commits/pushes, deployment or provisioning were performed.

Outstanding: exact OJET/pixel sign-off, chart/list drill reconciliation, full calendar parity, Home opportunity bookmark/share/notes/apply/convert workflows, full profile/preferences persistence and unbuilt Proposal/Opportunity mutation modules. Registration remains blocked on the VBCS Employee business-object contract/authorized server access. Cloud IDCS compatibility and release-grade row/access/concurrent-session verification remain administrator tasks.

#### Navigation placeholders — 2026-10-14

Added Ethics, Due Diligence, Awards, Contracts, CGA, Reports, Announcements, Administration, Customer Support and API Documentation to the existing sidebar at the user's request. Each links to a known, authenticated `/modules/[module]` placeholder with “Module not available for now” and Back to Home. No unavailable-module Oracle operations or external administration links are invoked. Existing implemented navigation retains its access gates. These entries are placeholders, not completed modules.

Navigation validation: Node 24 typecheck, targeted ESLint, git diff whitespace check and isolated production build passed. Existing authenticated Playwright session verified Ethics direct load, all ten drawer entries, and Awards link navigation to the expected placeholder. No unavailable backend module was called.

#### Account controls — 2026-10-15

Implemented protected read-only Profile, research interests/funders/keyword saves, Active/Out of Office/proxy management, dashboard preference switches/default-dark themes and seven source-derived Accessibility tiles with preview/cancel/persistence. See `docs/account-settings.md` for contracts and explicit parity limits. Account reviewer found no remaining critical/high issues after correcting Active cleanup. 161 unit/integration checks and twelve fixture Chromium journeys passed; typecheck/lint and isolated production build passed. Live DEV Profile/Manage reads were inspected separately. No live preference/status/proxy save was performed, no IDCS integration proof inferred, no deployment/commit/push.

## First increment checklist

Scope: Home, read-only Proposal listing, IDCS/GrantsNow session foundation. Final destination is the current Superset workspace, per the user’s correction; source lives directly in this repository. Legacy baseline inspected read-only: `6f1c81f0cc70d11b1ad0f1881e3a2f5db0c3675e`, compared with supplied inventory baseline `3acfe9e272e2db076d92942ebbf86776ae583077`. Existing untracked legacy docs and browser evidence preserved.

- [x] Read vault migration/architecture context and supplied three artifacts.
- [x] Trace session/bootstrap/validate/extend/logout and business-error handling.
- [x] Trace Proposal fields, filter transform, paging and sort.
- [x] Trace Home attention/statistics operations and preference gates.
- [x] Establish OIDC library + protected server cookie + service authentication gate.
- [x] Complete shell, Home and listing.
- [x] Validate types/lint/tests/build/browser and record precise evidence.
- [x] Update existing vault note.

Assumptions requiring live proof: token-bound listing row scope; identity owner's username claim; service-account trust; actual login expiry timezone; configured Home read grant; independent connectivity and exact metadata. No credentials or tenant URL provided. Production readiness requires these checks; fixture success does not prove them.

API mapping is documented in `api-mapping.md` and machine-readable allowlist `src/server/oracle/operations.json`. No API endpoints are inferred from naming alone.
