# GrantsNow rebuild — progress, plan and history

One file for where the rebuild stands. It merges four earlier documents verbatim, with their headings moved down one level:

1. Current progress, newest increments last (formerly `vbcs-parity-progress.md`).
2. The parity plan the owner approved on 2026-10-14 (formerly `vbcs-parity-implementation-plan.md`), which AGENTS.md cites.
3. History: the first increment's status and checklist (formerly `implementation-status.md` and `implementation-checklist.md`).

## 1. Progress

### Proposal Budget toolbar and entry navigation, 2026-11-05

The Budget record toolbar now lays out List on its own line and wraps Quick Cost through Comments, then Audit Trail and Print, as observed in the live VBCS comparison at a half-width browser window. The Budget tree uses the VBCS-style row action menu. Add Staff, Student, Pool Tech, Non Staff and Research Partner cost controls open dedicated Budget entry routes backed by the existing protected costing API, and Save/Cancel return to Budget. VBCS's Add Cost controls use role gates and can appear even when the matching button-label resource has `is_visible=N`; Budget follows the observed source gate. The existing staff row's Edit action currently opens the protected staff cost detail route, which remains read-only. Fixture browser tests cover tree action navigation and staff/nonstaff entry saves; no agent-initiated live Oracle write was made. See `docs/changes/2026-11-05-easwar-proposal-budget-navigation.md` for remaining parity limits.

### Proposal creation parity in progress, 2026-11-05

The live VBCS `proposals-info-start-page` calls `getSecurityUser_roles` for the proposal type before entering Summary, even when creation has no `proposal_id`. The Next.js route now calls the same type-level roles before rendering and reuses the shared Proposal `Summary` component in creation mode. The shared screen includes PI, proposal/funder/deadline details, attributes, opportunity, research partners, subproposals and dynamic forms. The create service accepts those payload sections and saves dynamic answers after Oracle returns a proposal id. The creation layout has been adjusted against the supplied VBCS screenshots. The VBCS create chain validates sponsor and partner rows before other fields; the Next.js creation form now focuses and scrolls to the first invalid control and displays the field-level message there. Creation asks the shared dynamic-form host to focus marked invalid fields without a generic toast; existing edit behavior is unchanged. Oracle response errors still use the source error code, description and preventive action in the toast, while success uses the type's resource bundle message. Fixture browser journeys passed for both kinds of feedback. A user-triggered live DEV save produced P_6751 / ID 10203 before the unchanged dynamic-form retry defect was fixed; no agent-initiated live Oracle write was run. Complete live parity remains unverified.

### Proposal Summary finalization parity, 2026-11-03

The Proposal tabs now show the VBCS green success mark from locked module page IDs, with the tab spacing and FEC Summary placement adjusted toward the source navigation. A finalized Summary shows the server lock-status message and finalizing user when the lock belongs to another session. Finalize no longer rejects blank Summary display fields such as Keywords or Assigned To; VBCS validates the rendered read-only controls instead. The record refreshes after a successful write. Fixture tests cover the icon, attribution and write with blank display fields. Live DEV finalization has not been run. See `docs/changes/2026-11-03-easwar-proposal-finalized-tab-indicator.md`.

### Ethics listing visual parity, 2026-11-03

The Ethics listing now places its toolbar and access tabs like the VBCS page, uses Ethics Type radios and the source filter order, and renders compact cards with configured date formatting and the response status badge. The shared listing styling also affects the Due Diligence entry, which passed its fixture browser journeys. This is a visual listing increment; linked-object, clone, and delete actions remain open as recorded in the initial Ethics entry. See `docs/changes/2026-11-03-easwar-ethics-listing-visual-parity.md`.

### Due Diligence module entry, 2026-11-03

The Due Diligence drawer now opens a role-gated listing with administration, participant and approver views, VBCS filters, separate Due Diligence Oracle reads, paging and recycle/restore. A protected create page saves a setup draft with validated organization, type, enabled form sections, participants and supervisor. A scoped record overview shows the saved header and people. The existing resource bundle key was corrected; the drawer and service gates use the legacy `DUE-DILIGENCE` access grant while Oracle objects/resources use `DUE_DILIGENCE`. Ethics listing now sends its own object headers. Fixture journeys cover listing, recycle, draft creation and record opening; see `docs/changes/2026-11-03-easwar-due-diligence-entry.md`. This is **not full module parity**: both Due Diligence and Ethics still need rendered and persisted dynamic responses, submit/edit workflows, additional record tabs, links and listing clone/delete.

### Ethics module entry, 2026-11-02

The Ethics drawer now opens a protected listing instead of a placeholder. The first increment includes role-gated administration, respondent and approver views; source filters and paging; application cards; a scoped record overview; recycle list and restore; a general overview draft creation path; and a validated legacy deep link. VBCS source chains and operation definitions were read before mapping Oracle calls. This is **not full Ethics parity**: response forms, stakeholder/reviewer workflows, attachments, history, reference linking, clone/delete and submit/approval flows remain to be built. The create form still needs the rendered dynamic form and participant panel. See `docs/changes/2026-11-02-easwar-ethics-entry.md`.

### Proposal listing create actions, 2026-11-02

The listing's Create new Grant App and Create outline proposal controls now open protected create routes. The outline action opens a choice dialog and its fresh-outline option. A create form loads the same PI, sponsor, cost model, and lookup operations used by the existing Proposal module, then posts the VBCS Summary create envelope through the shared Oracle API layer. Fixture browser journeys created both a Grant App and a fresh outline and opened their records. Outline creation from an Application of Interest and full create-form parity remain open. See `docs/changes/2026-11-02-easwar-proposal-create-entry.md`.

### Proposal Date Sort and Contracts New Contract placement, 2026-11-02

The Proposal listing's Date Sort now uses the single VBCS-style inside-label dropdown with its circular direction switch, replacing separate Sort by and Direction fields. A live Creation Date sort exposed an Oracle row whose status label was null; the display mapper now accepts it and leaves its status badge empty rather than rejecting the whole page. Both ascending and descending Creation Date loaded 10 of 1338 proposals in DEV. The Contracts New Contract action now sits beside the filter toggle and uses the source icon. The URL sort state and permission-gated create route remain unchanged. See `docs/changes/2026-11-02-easwar-listing-sort-and-contract-toolbar.md` for checks.

### Proposal listing Advanced Query, 2026-11-02

The top toolbar's Advanced Query button now opens the VBCS condition builder rather than a placeholder. Attribute choices are read from the advanced listing view and shared attribute metadata; operator/value conditions use the source operation and combine with the existing listing filters. Date Sort remains a separate sidebar control, placed before the created-date fields as in VBCS. Fixture browser and isolated build checks are in `docs/changes/2026-11-02-easwar-proposal-advanced-query.md`. The live DEV query has not been verified; disabled Proposal creation remains incomplete.

### Proposal listing record actions, 2026-11-02

The listing now exposes the VBCS Recycle bin and source-gated linked objects, share, clone, and delete card actions. The matching Oracle operations run through the server API layer with record/role/resource checks; clone, delete, and restore use explicit write payloads and draft/parent rules. The VBCS share-as-document route is wired to the report and people lookups, while share access enters the existing Delegation route. Details and check results are in `docs/changes/2026-11-02-easwar-proposal-list-record-actions.md`. Create remains incomplete as recorded there; this is not full Proposal parity.

### Proposal and Contract listing filters at phone width, 2026-10-30

The supplied phone screenshots show squeezed listing filters and blank Contracts dropdowns. The Contracts form hid the label for an empty `Select`, while `Select` itself had no placeholder; its two-column phone grid made each control narrow. The Proposal listing likewise kept two filter columns at 390px. The listing styles now use one aligned filter column through 600px, and the Contracts empty dropdown label remains visible. This is a reproduced listing layout defect; the shared `Select` and `FilterPanel` behavior is unchanged. Fixture browser measurements and full checks are recorded in `docs/changes/2026-10-30-easwar-listing-filter-alignment.md`.

The side-by-side desktop browser check at 904px found another Proposal layout defect: Category choices rendered inline without spacing, and the filter controls were narrower than VBCS. The Proposal filter form now fills the same sidebar inset as VBCS and stacks Category choices in separate rows. The VBCS Contracts list returned `undefined : undefined` errors and no data during this check; the Next.js DEV browser session had expired, so the Next.js comparison used the explicitly labelled synthetic fixture preview. No live DEV data behavior was inferred from the fixture.

The follow-up browser comparison found the searchable LOVs had two visible outlines, the Proposal filter toggle sat inside the sidebar instead of the results toolbar, and a Rows per page footer appeared in Next.js but not VBCS. The listing-only field styles now keep one outline around each LOV, the Proposal toggle uses the existing Contracts collapse icon in the results toolbar, and the Proposal footer is removed while scroll loading remains. These are UI parity fixes; query parsing and Oracle pagination remain unchanged.

### Azure integration: guided tour completion, 2026-10-30

The full fixture suite reproduced a guided-learning defect after the Azure pull: Escape hid the tour, but `gn-guide:home-tour:v2` stayed unset. In driver.js 1.10.2, calling `destroy()` while `onDestroyStarted` remains registered invokes that hook again and returns before cleanup. The shared guide launcher now records completion in its close path, clears the hook after its exit animation, and destroys the tour. This changes the owner framework only for the reproduced defect; the existing Motion exit animation remains. The Playwright assertion waits for completion after the popover hides.

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

- Escape while Chrome's native date picker is open also closed the enclosing dialog. Since 2026-10-23 the card dialogs and the Advanced filter stay open while a picker inside them matches `:open` (`pickerOpen` in `date-input.tsx`); not yet confirmed with a real key press, which automation cannot send to the native picker.
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
- **Callers:** the proxy picker (`proxyPeople`) and Proposals' `lookups.ts` both read `people.inOrg`, which is paged whole; `account.proxyDirectory` (first page only) is gone (2026-10-23).

**Outstanding:**

- Owner: approve a live Submit for Approval on 3954, which notifies the DEV approvers.
- The live files run (upload, download, delete) once OIC accepts the credentials.

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

### Claims layout against DEV VBCS — 2026-10-30 (latest)

- **Done:** Claims e2e journeys (Unit Inquiry; Funds Inquiry and its record) on a labelled fixture; listings and Funds record measured against DEV VBCS at 2133×1017 and aligned (Clear Filters at the drawer foot, centred View, unit panel spacing and widths, filter-bar and table panels, 336px selects). Dev badge off (`devIndicators: false`): it covered corner controls. Record: `docs/changes/2026-10-30-titiksh-claims-vbcs-layout.md`.
- **Evidence:** typecheck clean; lint 0 errors; 90 files / 891 tests; isolated build passed; e2e 30 passed, 2 skipped (mocks; layout numbers from fixtures vs live VBCS).
- **Live follow-up:** Unit and Funds cards re-measured on live DEV against VBCS; now within 1px (Unit 238 vs 239, Funds 102 both). A Claims-only row padding override was the main cause and was removed. Checks re-run: all pass, e2e 30 passed, 2 skipped.

### Claims Funds Inquiry record — 2026-10-30

- **Built:** `/claims/funds-inquiry/[id]/[tab]` on `RecordFrame`: Summary, Budget, Claims and Attachments, the filter bar in the URL, Export per tab, CLAIM_FUNDS access (fail closed). The listing's rows open it. Record: `docs/changes/2026-10-30-titiksh-claims-funds-record.md`.
- **Live DEV (reads; Export generates a file only):** fund 641 Summary (8 lines), Budget with default Instruction/Salaries (1 activity, £10,000) and Object 200 (£22.90, matching Summary), URL and tab links carrying the filter; fund 521 Claims, Approved: 4 lines totalling £6,392 (equal to Summary's approved claims), In Process: empty (Summary £0); Attachments panel (no upload or delete); Export: `Fund_Claim_Lines.xlsx` from the button, `Fund_Listing_Report.xlsx` and `Fund_Activity_Budget_Details.xlsx` from the route; Attachments export and an unknown filter refused (400); a fund without roles: DEV's "User Does not have Access" shown, no data. Downloads stubbed in the page.
- **Evidence:** typecheck clean; lint 0 errors; 90 files / 891 tests. Build and e2e below.

### Rebase onto Easwar's Proposals merge; Proposals brought onto the framework — 2026-10-30

- **Rebase:** fast-forward to `aec5020` (Easwar, Codex: Proposals parity, 107 files). Conflicts in the allowlist, API index, client and connection resolved; the Claims / Collapsible / Export work restored on top. Record: `docs/changes/2026-10-30-titiksh-rebase-proposals-onto-framework.md`.
- **Did Easwar's agent follow the steering?** Mostly. Followed: change records in the template, its one framework edit logged with a reproduced defect, named API functions, `functions` / `serverFunctions`, session-held lookups, no native controls or hand-written dialogs/details/tables-as-dialogs, no direct `oracle()`, no server actions, full checks run. Missed: UI in route folders (~5,900 lines), 13 raw tables, ids on about half the buttons, three local `Intl` formatters, Proposal operation names in the shared connection, two hand-built overlay dialogs, a report-file path built in parallel. All fixed; agent guide §4/§5 sharpened, §9 self-check and §10 added, `AGENTS.md` step 5 points at §9.
- **Defects found by testing and fixed:** Proposal Print's `report_code` pair (legacy sends the page name; DEV said "report_code cannot be null"); the Proposal Contracts tab missing legacy's `object_ref_id` where-clause (DEV returned unlinked contracts and the tab refused the page).
- **Structure and framework (owner):** guide §4 is now the exact folder map, request path and record framework, with §9 checks; still off the map, listed in guide §10 for whoever next works there: the Proposals and Contracts record shells (no `RecordFrame`), their flat server folders, and Proposals' and Opportunities' `components/`. Claims' own server code was split to `claims/{units,funds}/{listing,actions}.ts`.
- **Self-check findings outside this merge (left for their owners):** native date inputs in Contracts New and the Contracts and Proposals listings (Contracts' are already open in guide §8); hand-written `<dialog>`s in Home's insight widget and remote tabs; `Intl` in Opportunities analytics, Home insight chart and service, Awards installments model and Contracts format.
- **Live DEV (reads, plus Print and Export, which generate files only):** Claims listings and Export (listing XLSX, row PDF; unseen app 404; bad body 400; GET 405); Proposals listing; record 10193: Summary (funder and deadline `DataTable`s, `StatusBadge`), Budget tree (collapse 11→4→11 rows, totals footer, year split 15 columns, View cost), Staff costing (`ReadonlyField`, cost-line table), Credit Allocation, Funder Rules, Contracts (now an empty page, correctly), Edit mode (funder row edit and cancel, Add Deadline `ActionDialog` with Escape, versioning prompt on a period change: Yes shows the fields, Cancel sends nothing), Print (`Print_Proposal_Report.pdf`), Comments and Audit drawers with their new ids. Nothing was saved. Downloads were stubbed in the page, so no file reached the disk.
- **Evidence:** typecheck clean; lint 0 errors (the existing warning); Prettier clean; 89 files / 888 unit and integration tests; isolated production build passed; full e2e 28 passed, 2 skipped, 0 failed (including Easwar's new Proposal journeys, on the moved pages and converted tables); rerun after the Claims server split and the structure instructions: build passed, e2e 28 passed, 2 skipped, 0 failed.
- **Not seen live:** linked Contract rows (no DEV proposal with links found); FEC Summary's analysis (the external costing-analysis service did not answer); delegation page groups (no DEV award with delegations).

### Awards remaining tests and Claims listings — 2026-10-30

- **Awards, live DEV writes (owner: DEV data is test data; Send to ERP skipped by the owner):**
  - Link: AW_20230807 (1182, no proposal) linked to P_6699 "demo1" from the listing dialog; re-read shows the proposal, and the backend also set the award's title to "demo1".
  - Create from a proposal (GenerateAward): P_6676 "testing" made AW_20230811 (1186, Draft), with the proposal's title, PI and dates, not the form's.
  - Clone was saved and re-read on 2026-10-26; not repeated. Send to ERP: fixtures and integration tests only. Due Diligence Create / View: the module is not built.
  - Awards listing e2e: passed in a full run under load (21 passed, 2 skipped).
- **Claims phase 1 (owner order: listings, then Funds record, Unit record, activities, claims, approvals):** `/claims/unit-inquiry` and `/claims/funds-inquiry`. Record: `docs/changes/2026-10-30-titiksh-claims-listings.md`.
  - Live DEV reads: unit list 25 of 64, every filter, paging; funds list 25 of 52, every filter, paging; Funds Summary of fund 641 (8 lines); create setup, fund types, grants (2026 / 2027 have grants; Title II, IV, Bilingual auto-select), clone tree (three levels).
  - Live DEV writes: Create 1065 (School of Nursing, FY 2027, Title II with grant 494105 / account 54320) and re-read; Update 1065 (claim date, Title IV added) and re-read; Clone 1065 to FY 2028 made 1066. Refused before writing: removing a submitted fund (app 641), an unoffered grant. Create without a grant gives the backend's FPCG036, shown as a toast.
  - Found: 1066 came back with no funds although Application Funds was ticked (DEV has no FY 2028 grants; cause unverified). `object_code` and `function_code` arrive as numbers. A route handler kept a stale `constants` after an edit until the dev server restarted (the "limit=undefined" 400s); not a code defect.
  - Fixed on the owner's report: the Claims pages had the Home workspace's side padding; `/claims` now uses the module workspace.
- **Follow-ups the same day (owner):**
  - One `Collapsible` for every expandable panel (it owns the chevron and its turn); eight places moved onto it. Record: `docs/changes/2026-10-30-titiksh-collapsible-and-export.md`.
  - Claims Export (toolbar and row) through a new file read in the API layer. Owner review: `generateReport` is allowlisted as a POST read.
  - Browser pass, live DEV, both listings: status tab, every filter through the dropdowns, Clear Filters (disabled when empty), drawer toggle, paging to the end (66 and 52 rows, no duplicates), panels collapse and expand with the chevron turning, Create's duplicate-fund error, Update dialog prefill and row edit, Clone (Entire Unit, required year, Cancel), Summary open and Escape. Export: listing XLSX (12 KB; 8.7 KB filtered), row PDF (141 KB), an unseen application refused (404), the button disabled while it runs; the browser save was stubbed, so no file was written to disk.
  - Moved panels seen live: award Project Team, Approval Route (Graph View does not collapse it) and History, Approval History, linked-records groups.
- **Open:** Claims fixtures for integration and e2e; record pages; visual measurement against live VBCS Claims.
- **Evidence (after the follow-ups):** typecheck clean; lint 0 errors (the existing warning); 80 files / 853 unit and integration tests; isolated production build passed; full e2e 21 passed, 2 skipped, 0 failed (dev server on DEV running alongside). Claims has no e2e journey yet.

### Rebase, performance, framework rules and shared UI — 2026-10-29

- **Rebase:** fast-forward onto `af86ddf` (Ayush's Guided Learning, PR 487; Awards, PR 486). Guided Learning reviewed against the framework; `driver.js` agreed by the owner, guide text stays literal until the feature is complete. Its auto-starting tour broke 11 e2e journeys; e2e now marks every guide finished. Records: `docs/changes/2026-10-29-titiksh-rebase-guided-learning.md`.
- **Structure:** Contracts' UI moved out of its route folders into `src/features/modules/contracts/{listing,new,record}`; Contracts got its `error.tsx`; a dead EOI re-export removed.
- **Performance (owner rules):**
  - Pages await only their shell and stream lists, sections and panels: the four listings' first page streams into `usePagedApi` (`functions.errors.settle`), the finder's options and banner stream through `useStreamed`.
  - "Ten things never wait for one": Awards, EOI and Proposals dropdown choices and the approval history each read on their own (`?list=` / `?group=` / `?view=`, `choiceList`).
  - Lookups and org units are held for the session (server and browser), as the live app holds them. Backend calls wait up to 10 minutes (Oracle, paged lists, OIC; the undici pools' 5-minute defaults raised).
  - Records: `docs/changes/2026-10-29-titiksh-stream-listings.md`, `…-independent-reads-constants.md`.
- **Constants and functions:** one categorised object each, `constants` / `serverConstants` and `functions` / `serverFunctions` (pure helpers only; services stay in their modules).
- **Defects fixed:** the dropdown windowing loop (Funder flickered between 12 and 1,691 rows and froze the tab: the list scrolled its own padding; the panel scrolls now) and its width (fixed to the field); the navigation drawer closing a click replayed during hydration (the rotating e2e failure); the Preferences switch thumb 8 px high (an inherited `translateY(-50%)`); the Awards Edit Global row centred on half the form.
- **Shared UI (owner rules):** every table is `DataTable` (flat or tree, column spans, row actions pinned at the row's end, operations in the parent; no raw `<table>` left); read-only values are label-value pairs (`ReadonlyField`, borderless `[readonly]` controls); skeletons take the shape of their content (`ListingSkeleton` / `DetailSkeleton` / `FormSkeleton` / `TableSkeleton` / `ListSkeleton`; `RecordSkeleton` renamed); presses at `--gn-press-scale` 0.99; truncated text shows its full value on hover (`TruncatedTitles`); Guided Learning moves with the `motion` presets (menu, popover, overlay). Records: `…-dropdown-window-and-award-choices.md`, `…-tables-readonly-skeletons.md`, `…-guide-motion.md`.
- **DEV findings (GrantsNow KB):** the unfiltered Awards listing takes 15–33 s (1 s with an org filter; VBCS sends the same request); the Awards org-unit lookup (`p_obj_type: AWARD`) takes ~52 s for 3 KB (0.8 s without it). Owner: no default org on the listing.
- **Open:** the slow DEV lookups (backend owner); Easwar's next rebase meets the Contracts move, the functions modules, the Proposals choices and the tables — check then whether his agent followed the rules; guide text to the RB once Guided Learning is complete.
- **Evidence:** typecheck clean; lint 0 errors (the existing `useVirtualizer` warning); 79 files / 844 unit and integration tests; isolated build passed; full e2e 21 passed, 2 skipped, 0 failed (with the new Guided Learning journey); live DEV checks in each change record. Nothing committed.

### Viewport layout finished and checked on DEV — 2026-10-27

- **Owner rule (2026-10-26):** layout in vw/vh, then %/fr, translated from the legacy JET class or legacy px ÷ 1745 (width) / ÷ 1043 (height); no fixed px caps. Details and every value: `docs/changes/2026-10-26-titiksh-contracts-onto-framework.md`.
- **Dialogs:** every `ActionDialog` follows its legacy dialog. Budget and Credit are `oj-md-10` (83.333vw). A legacy dialog with no width class is Redwood's fixed 600px (measured on live VBCS, not content-sized), so `width` is optional and defaults to 34.384vw, at most 70vh tall (owner). Confirm, history status, contract deadline, share, notes, award links, linked objects, milestone, idle and chart-dimension dialogs use it.
- **Containers:** notifications 33.333vw, finder Advanced filter 40vw, profile dialog 66.667vw, Insights filters 13.754vw, add-approver 33.333%, calendar sidebar and panel 12.607 / 16.046vw.
- **Owner decisions (2026-10-27):** drawers stay in rem as legacy (navigation and Contracts sidebar 20rem, matching the resizable filter panels; configure 26rem within 20–31.25rem; record drawer 30rem for Comments and Audit); fixed legacy heights become vh (expanded chart and attention calendar 47.94vh, attachments tree 28.763vh); approval graph node 250 × 100px as legacy Treant.
- **Found on the visual pass:** the record drawer's Motion preset animated to 400px over the CSS (now 30rem); `.createPage dialog` gave every New Contract dialog 520px. Dead CSS removed (`.contractFacts`, `.opportunity-information`).
- **Open:** the visual-pass list (profile status fields, attachments detail pane and link form, approval comment cap, chart sizes, skeletons); the approval graph node unseen on DEV; the Awards listing e2e flake; login card and unavailable placeholder have no legacy counterpart.
- **Evidence:** typecheck, lint (the existing warning), 820 unit/integration tests. Isolated build passed before the dialog default. Full e2e 19 passed, 2 skipped, 1 failed (the Awards listing flake, under load); alone it passed 3 of 3. Live DEV measured at 1745×1007; live VBCS dialog widths at 1745. Nothing saved on DEV or live.

### Contracts brought onto the shared layers — 2026-10-26

- **Owner (2026-10-26):** bring whatever the Contracts merge diverted back in line with the KB and the rules, without breaking it.
- **Layout:** `src/server/contracts` → `src/server/modules/contracts`, `src/features/contracts` → `src/features/modules/contracts`.
- **API layer:** the generic `contractRead(op, headers…)` passthrough is gone. Contracts reads go through named functions: `contracts.list/byId/versions/signers/relationTypes/relationItems/templates/placeholderTags`, plus the shared `roles.record`, `lookups.codes/objectDates`, `people.all`, `dynamicForm.forms`, `eoi.finalizablePages/lockedModules/lockStatus`. New Contract's two server actions are API routes (`/api/contracts/choices`, `/api/contracts/assignees`) read with `useApi`; document downloads use `contracts.documentUrl`.
- **One record context:** `contractRecordContext` (roles through `objectAccessOf`, fail closed, plus the finalize state) replaces four hand-rolled grant checks. Comments and audit use the shared `recordHost` (writing a comment needs the page's edit, as on every record); the audit reads `objects.audits` like every host.
- **Workflow on the shared approval host:** `contractApprovalHost` with the legacy fragment's keys (`contracts-workflow`, `contract-add-stage`, `contracts-add-approver`, `contracts-change-approver`), `/api/contracts/[id]/workflow`, and the shared `ApprovalWorkflow`. Easwar's read-only copy (its own stages/graph/approvers/history reads, a `?stage=` approvers dialog, `Asia/Kolkata` times) is removed. Contract approvals now offer the same actions as EOI and Awards, gated by the record's roles. No live approval was run.
- **Workflow and Signers tabs:** legacy getTabs: past draft and rework, or every finalizable page finalized. Easwar hid them in draft and rework unconditionally. An unreadable finalize state keeps them closed.
- **Graph View is lazy on every host:** `?view=graph` is read when the view is first opened (legacy loads it on the tab), not with every route read.
- **Approval history times:** `approvalHistoryRows` passes the raw time and `LocalTime` (new, `components/ui/local-time.tsx`) shows it in the viewer's zone after hydration. Before, the shared workflow printed the raw clock time and Easwar's page printed IST. The Contract Version (`name - date hh:mm a`) uses it too.
- **Record header:** built from the service's RB-gated, RB-labelled field list in legacy order (status as `StatusBadge`, Created by as `CreatorLink`) plus Contract Version under `contract-version`. Before, eight labels were hard-coded and the RB list was built but unused.
- **Status names and tabs:** the listing's status tabs and any blank status name come from the configured `CONTRACT_STATUS` lookup (`statusChoices`), replacing two hard-coded lists. An unreadable lookup leaves only All.
- **Smaller fixes:** text filters use `containsClause` (LIKE escaping); New Contract's dynamic fields hide unless `Y`/`C`; the deadline dialog is `ActionDialog` with `DateInput`; about 50 Contracts elements got ids; the Select loading state carries `aria-busy`.
- **Removed as dead:** `contractDelegations`, `contractHistory`, `contractComments`, `contractAudits`, `parseContractAuditEvent`, `requireContractTab`, the approval `graphContent`/`compactGraph`/`showHistory`/`standalone` props and their CSS. Easwar's per-response "another contract's rows" checks on stages, approvers, history and comments went with them: the shared reads used by EOI and Awards do not make them.
- **Checked against legacy and kept:** the read-only file field's disabled drop box (legacy `oj-file-picker` with drag-and-drop text) and the plain-text delegations empty state (legacy noData slot).
- **Still open (Easwar's module):** the Summary tab lacks legacy's editable Contract Detail form (`summary-*` fields); New Contract is a disabled preview with its own dynamic-field renderer and native date inputs, so it should mount the shared `DynamicForm` when Create is built; the listing's date filters are native date inputs in a GET form.
- **For the owner:** `exceljs` (placeholder-tags workbook) and vendored Treant/Raphael (legacy's graph renderer) were added without the agreement the rules ask for; Easwar's measured colours are left for the theme pass; the doubled Playwright timeout is kept.
- **Approvals layout (owner, measured on DEV):** the shared workflow is legacy's `oj-sm-10` column (83.333%, centred, no 1000px cap), with Route and History stacked without a gap, oj-collapsible chevrons, and content-sized stage card columns. Ours is x=158, 1427px; live is x=155, 1434px; the stage card is 87 vs 86px.
- **Agent context (owner):** `docs/agent-guide.md`, a mandatory block at the top of `AGENTS.md`, `CLAUDE.md` importing both, and `docs/changes/` (one record per change set, read before touching the same files). They make Codex and Claude Code load the rules, the reuse catalogue and the override record (§8) before changing or rebasing.
- **Layout rule:** app-wide, layout uses vw/vh first and %/fr otherwise (foundations, Look and feel). The conversion is part done; see `docs/changes/2026-10-26-titiksh-contracts-onto-framework.md` for what is converted, unverified and left.
- **Evidence:** typecheck, lint (one existing warning), 820 unit/integration tests (Contracts access rewritten per operation, plus draft/finalize gates, unknown lock, configured status names, the lazy graph). Isolated production build passes. Full e2e with both slow-fixture Contracts journeys on: 21 passed, 1 failed. All Contracts and approval journeys passed. The failure was the Awards listing journey timing out under load; it passed on its own before, and was not re-run after the dialog edits. Live DEV reads: contract 1386 (RB header, version time in the viewer's zone, shared workflow with 4 stages, lazy graph with 5 nodes, the approvers dialog, 5 history rows in viewer time), the Contracts listing's 9 lookup tabs (they match live), and the EOI 4034 approvals layout against live.

### Rebased onto origin/main (Easwar's Contracts module) — 2026-10-26

- **Upstream (d77fd6e, three commits):** the Contracts module (listing, new, record tabs: summary, workflow, signers, history, delegation), contracts on the shared comments/audit panels and object history, approval List/Graph/Table/Card views, an exceljs export, a doubled Playwright timeout, and an allowlist trimmed to what the server named at the time.
- **Kept as is:** the Contracts module and its flows, the shared panel hosts (union with eoi/award), the delegations `.end` alignment (matches legacy), the e2e waits.
- **Fixed on top:**
  - The allowlist dropped 8 operations Contracts still calls (`getGetAllContracts`, `getContractsContract_id`, signers, versions, relation type, template name, placeholder tags, approval graph); they are back, and placeholder tags go through `contracts.placeholderTags`.
  - Easwar's history stamped times on the server in `Asia/Kolkata`; history now passes the ISO time and the browser formats it in the viewer's zone (`stampDisplay`).
  - Approval view labels come from the RB (`approval-*-view`); Graph and Card show only when their key is visible, and the graph is read only then.
  - Contracts routes moved into `(list)`/`(record)` so a record opens on the record skeleton, not the listing's.
  - All 10 native `<select>`s in Contracts are `FormSelect`/`Select`.
  - Contract Created by uses the shared `CreatorLink` (`/api/contracts/[id]/creator`).
  - Contract status uses `StatusBadge` (`CONTRACT_STATUS_TONE`). DEV has `SUBMIT_SIGN` rows with no status name; legacy rendered an empty pill for those, and the badge is now left out when there is no text. `SUB` ("Submitted for Signing") is success.
  - `exceljs` pinned to 4.4.0; duplicate icon keys removed; the dead `contract-resource-defaults.json` deleted; the contracts relation-item fixture no longer shadows the award one.
- **Noted at the time:** these were closed by the follow-up above.
- **Evidence:** typecheck, lint (one existing warning), 825 unit/integration tests. Live DEV reads: Contracts listing (no empty pills, no native selects), record 1386 (Created by card, Graph and Card views), award 1183 history, delegations, comments and audit drawers, EOI 4034 history and approvals graph. DEV Oracle was slow (contract read 44 s). Isolated production build passes; full e2e 20 passed, and Easwar's two slow-fixture Contracts journeys (skipped unless their delay variables are set) pass when run with them. They caught one regression from the Select conversion: the loading filter lost `aria-busy`; `Select`/`FormSelect` now take `busy`.

### Award record — 2026-10-26

- **Shell** (`/awards/[id]/[tab]`, legacy awards-detail-page):
  - **Access:** the Awards grant, then the award's roles. No `awards-header` read denies the award, with legacy's toast and a return to the listing.
  - **Data:** AwardDetails, with the dates spanned by AwardPeriodDetails (legacy blanked the whole award when the period read failed; here the award keeps its own dates). Finalized ticks come from `locked_modules`.
  - **Tabs:** legacy getTabs. Each needs read on its page (fail closed). Approvals also needs AIA, IA or SUB, or every finalizable page finalized.
  - **Panel:** each cell shown only with a value and its `labels.*` visible.
  - **Toolbar:** Finalize (`insertModuleLock`, module AWARD), and Comments / Audit Trail per page.
  - **Not offered:** Send to ERP, because its OIC flow has no path in the contract.
- **Shared frame:** `features/record/shell` (`RecordFrame`, `useLeaveGuard`, `record-tab.module.css`) now carries both the EOI record and the award record. EOI keeps its ids; its browser journeys pass.
- **Shared tabs**, hosted for AWARD:
  - Attachments (the award number as the folder; editable in a draft with page edit and an open lock).
  - Approvals (the award number under AWARD; Withdraw also needs `awards-approvals-withdraw` read and edit).
  - History (AWARD_STATUS; the `award-add-status` and `award-history-abandon-button` roles).
  - Delegation (defaults to the header).
  - Comments and Audit (`recordHost`, one generic panel host).
  - Dynamic Form 1–5 and the Header's AWARDS-HEADER form (`authorizeAwardForm`: roles, draft, lock; the award bundle).
- **Header:**
  - The form, gated by RB and required from it; Billing Party is editable only with `awards-header-billing-party`.
  - Attributes (host `award-header`), the AWARDS-HEADER form, and the award periods table with its edit dialog.
  - Edit Award Header / Save / Cancel sit in the shell, as legacy.
  - The save is an explicit PascalCase pick: hidden or read-only fields keep the award's own values.
  - Legacy defects fixed: the billing party is no longer the funder when none is set, and the proposal is the award's own, not the URL's.
- **Budget Periods:**
  - The table with totals, and one Add / Edit dialog using legacy's recalculation (`recalc`).
  - Legacy defects fixed: a zero total gives 0, not Infinity; a new period no longer computes NaN; direct and indirect may raise the total.
  - The save is an UPPER_SNAKE pick, with dates kept inside the award's dates.
- **Project Report:** the award's own first project (legacy always reported project 1 and printed PRJ_200): totals, the yearly chart and table, actuals by month.
- **Due Diligence:** the linked records, with the `dd-list-*` gates. Create, View and Link wait for the Due Diligence module.
- **Installments, Milestones:** not available. Legacy kept Installments in the browser tab only, and Milestones never saved.
- **Projects** (legacy awards-projects), with inner tabs Projects / Project Costs / Project Team:
  - **Projects:** the RB-gated table, plus Add / Edit in one dialog (Add Project needs the `awards-projects-add-project` role, a draft, the editable award, page edit and an open lock). The save is legacy's PascalCase pick; ids, number, ERP id and schedules come from the award, never the browser.
  - **Project Costs:** the global funder / institution split (`globalChange`) and legacy's cost tree per project (section → category → costing group, STAFF first, `costTree`). Section and category Edit post the split (`AwardPrjCostLine`). A line's Edit / Clone / Delete use the line dialog (`splitChange`), with its category's items and its periods; Add Row appears with `SPLIT_AWARD_COST_ITEM_BY_PERIOD`.
  - **Project Team:** one table per project, plus Add / Edit; the only project and role are pre-filled when required.
  - **Legacy defects fixed:**
    - Share caps compared a fraction with 100, so they never held; they are now enforced (D1).
    - NaN and negative input is refused (D3).
    - A changed GL nominal is sent; legacy kept the first one (D11).
    - Period rows now send hours and months (D12).
    - The global edit checks the lock and the award (D15).
    - Section and category edits need the line's `is_editable` (D24).
    - Choosing a cost item brings its GL nominal (D10).
    - The server checks every chosen value is offered, dates stay inside the award (periods inside their line), and the line written is found in the award's own lines.
  - **Kept as legacy:** delete has no confirmation, and deletes the whole costing group.
- **Evidence:**
  - **Mocks:** `tests/unit/award-record.test.ts` (recalc, periodBound, costTree, splitChange, globalChange, withPeriodDates). `tests/integration/award-record.test.ts` (access, tab read, budget gate, finalize, and every Projects write with its gates). E2E "Award record Projects" against the labelled `test-support/award-record.ts` fixture. The listing journey now opens the record.
  - **Live DEV, read only:** Projects, Project Costs, Project Team and the project and cost dialogs on awards 1180 (AIA, gated read-only) and 1179 (draft).
  - **Live DEV writes (2026-10-26, approved by the owner, DEV data only; `WRITES_ENABLED=true` set for the dev server process, `.env.local` untouched):** on draft 1179:
    - Header save (Actual Award Date, Billing Cycle).
    - Award period amount.
    - Budget period add and edit (recalc verified: 300 + 100 with funder 250 gives institution 150; then 350 / 450).
    - Project edit.
    - Team member dates.
    - Global split 50%.
    - Staff category split 60/40.
    - Line clone and delete.
    - New Materials line (the item brought its GL nominal).
    - Period row edit to 300.

    From the listing: Create Award (AW_20230806) and Clone with Budget Periods (AW_20230807). Each saved and re-read correctly.
    - **Not run:** Link. DEV's `getSharedObjectLinked2` timed out at 60 s on every try, so the dialog could not open.
    - **One transient 403** on a cost add: the lock read failed, so the page was treated as locked (fail closed). It saved on retry.
- **Look matched to live (measured 2026-10-26):**
  - **One table style for the app (`gn-table`):** a 40px brand header, 12px cells padded 9px 12px on #f1efed, a 15px bold footer, and a start-aligned "No data to display.".
  - **Table heights (`gn-table-scroll`):** legacy's max heights, with the rows scrolling under a pinned header: 31.25rem by default; 300px for the award header and Projects tables; 70vh for the cost tree; 55vh for cost periods.
  - **Record view mode:** fields are read-only text (`ReadonlyField`) in four columns, in one panel with the attributes, as legacy `readonly` forms render. Editing uses inside labels in four columns.
  - **Projects tab:** a centred inner tab bar; the global split as a read-only start-label form; tree expanders with warning-coloured group names; group amounts bold and percentages 15px bold; the ≡ line menu (shared `ActionMenu`, also used by the home chart menu); animated project collapsibles (shared `Collapsible`).
  - **Detail pages:** the action bar and tab bar are a fixed head; only the body below scrolls, so its scroll bar starts under the tabs (every RecordFrame page: EOI, opportunity, award).
  - **Cost tree indent (measured):** text starts 30px (section), 49px (category) and 60px (line) into the first cell, as legacy's `padding-left: 60px` leaf cell.
  - **Project Report tree:** legacy tMonthlySplit's group row (expander, warning-coloured name over all but the last two columns, total in those two); child rows are not indented. The earlier invented 24px indent and tinted group row are gone.
  - **Loading:** a `loading.tsx` cannot cover the `layout.tsx` beside it, so opening a record showed the parent listing's skeleton. Listings and records now sit in `(list)` / `(record)` route groups (awards, opportunities, EOI); verified on DEV: opening an award shows "Loading award".
  - **Motion (owner rule, every interaction):** table rows fade in (loads, added rows, expanded levels); record tabs, keyed tab panels (Projects inner tabs, audit, home modules) and the widget calendar fade in; the comments / audit drawer slides open to 400px and closed, pushing the page.
- **Legacy defect noted:** the live header's Award Periods table shows "No data to display." even though AwardPeriodDetails returns rows. The page assigns them from a shell event that fires before the page listens. The rebuild shows the rows.
- **Column visibility:** as legacy. The Projects table and the cost tree gate by RB; Budget Periods, Award Periods, Team and Report columns have no RB gate in legacy, so none was added.

### Award record — live E2E on AW_20230801 (award 1176), 2026-10-26

- **Compared tab by tab with live.** The data matches on Header, Budget Periods, Projects, Project Costs, Project Team, History, Delegations and Documents.
- **Live DEV writes, each re-read:**
  - Header save: Actual Award Date 26-Oct-2026 and Billing Cycle Quarterly; live shows both.
  - Comment posted, and the audit trail lists it.
  - Finalize ticked (the tab gets its mark), then unticked.
  - Budget period: institution 20.00, funder recalculated to 300.51.
  - Team member dates.
- **Fixed against live:**
  - **History times:** they were UTC on the server; they now show in the viewer's zone, as legacy's datetime converter (`stampDisplay`). Both history tables keep their header when empty, and the headings are 15px/800.
  - **Record panel:** three columns filled 4/3/3 as JET (`columnPlace`), 1.15rem labels, a 50px pitch, a bordered panel. Each label has its More Info. The Finalize control is a checkbox (legacy `oj-sample-checkbox-switch`), here and on EOI.
  - **Created by** opens the creator's card (new read `getProposalContactDtls`, through the API layer: `GET /api/awards/[id]/creator`).
  - **Award icons:** `edit` instead of `pen`. No plus icon on Add Project, Add Project Cost or Add Team Member. Edit Global is centred and quarter-width, with its icon, and so are Cancel and Save.
  - **Documents:** the tree is content-width with folder icons, and empty detail values stay blank.
  - **Tab icon:** the legacy favicon (`/images/gn.ico`).
- **Installments and Milestones, built as legacy has them (owner, 2026-10-26):**
  - **Installments:** all browser-side, per-tab sessionStorage under the legacy key `awards-installments:<id>`. It has the progress bar and legend, Total Funder Contribution and Balance, New / Edit / Delete, Amount or Percentage, and statuses with Overdue past the due date. Each installment is prorated over the cost lines; the largest line absorbs rounding (`installments-model.ts`). On DEV award 1176 a £50,000 installment gives the same table as live, row for row.
  - **Milestones:** an always-empty table and Add Milestone, enabled only on a draft. It opens the `AWARDS-MILESTONES` dynamic form; that slot is now allowed for the award, on the Milestones page's rights. Its Submit has no action, as in legacy.
- **Kept, by decision:**
  - Create Governance (Risk Assessment) opens the Due Diligence module, which is not rebuilt.
  - The shared Documents panel keeps its Download button (legacy downloads on double-click).
- **Recheck (EOI panel, dynamic-form tabs):**
  - **Record panel:** the EOI panel uses the same legacy style (two columns, filled downwards), so it now applies to every record frame. The award and EOI **Created by** both open the creator card (shared `personCard`, `CreatorDialog`). The EOI one was empty until the EOI record kept the person's `org_unit_id`; its own person schema had dropped it.
  - **Dynamic forms:**
    - A null colspan is one column, as the fragment's `calcColSpan`; only a missing one is a full row. GN-Angular had made null a full row.
    - Controls narrow to `colspan × maxColumns` twelfths of their cell, as legacy's `oj-md-n`; rich text and files stay full.
    - Dynamic Forms 1–4 on award 1176 now place every field as live, except the legacy defect below.
  - **Switches:** one global style on `input[role="switch"]`, measured on live: 27×15, grey off, darkseagreen on with a brand border (legacy redwood-overrides), a 12px thumb. The two copied track styles are gone. The attachments New Folder toggle now draws as a switch (legacy `oj-switch`); the configure drawer keeps its own.
  - **Legacy defect, not copied:** a hidden dynamic-form field (`isVisible` N, or a false condition) still holds its cell in JET's form layout. That leaves a hole (DF2 beside Rich Text Editor, DF4 beside Check box). Here hidden fields take no space.
- **One status bubble, one Created by flow (owner, 2026-10-26):**
  - **`StatusBadge`** (`src/components/ui/status-badge.tsx`, text + tone + optional solid) is the only status bubble. It follows legacy oj-badge, measured: 12px on an 18px line, 0 9px padding, a 9px radius; subtle tones are text-coloured on a translucent tint, solid is white on the tone. It is used by:
    - the award and EOI lists and record panels;
    - Due Diligence, linked records, the audit trail and approval stages;
    - Proposals cards and the record page;
    - installments (Overdue is solid danger).
  - Removed: `.record-chip` tones, the listing's own size override, the installments badge, and the duplicate award / EOI tone maps (one map per module in `src/shared`). The opportunity card keeps legacy's own `opp-status-badge` (with its dot). Legacy's approval stage badge is 14px inline; it now takes the common size.
  - **Created by:** the record frame owns it. A panel cell marked `creator` becomes the link, and the frame opens `CreatorDialog` from the host's creator endpoint. Each module adds one access-checked route over the shared `personCard` (awards and EOI today).
- **Checked against the awards prompt pack and the GrantsNow vault (2026-10-26):**
  - The prompt pack is input only. Where it differs from legacy, legacy holds:
    - the PI filter is `pi_pid` and the funder / billing party are matched by name, not employee number or ids;
    - the tab order is legacy's fixed `getTabs` (getProposalPages only supplies page ids for finalize);
    - cost delete has no confirm in legacy (left as is, for the owner to decide).
  - **Fixed from the vault's pitfalls / improvements:**
    - Installments now follows every other tab's change rule: a draft, the page's edit right, not locked or finalized (pitfall 10; legacy ignored all three).
    - Signing out (user menu or the idle dialog) clears the tab's sessionStorage, as legacy endSessionHandler does, so one user's installments never reach the next.
    - Every award dialog field (project, team, cost split, budget period, award period) shows its RB More Info when the key has a description (improvement 6, ticket 8886).
  - **Open, for the owner:**
    - **Send to ERP:** legacy takes the OIC path at run time from `custErpDetails.oic_endpoint` and posts the user's DB token in the body. It is not built; it needs an allowlisted endpoint and the ERP side-effect policy.
    - **Due Diligence Link:** it could be built on its own; Create and View need the Due Diligence module.
    - **Credit allocation:** stays out; the vault records it as orphaned in legacy, with four bugs.
- **Send to ERP, cost delete confirmation, Credit allocation (owner, 2026-10-26):**
  - **Send to ERP:**
    - Where: a red button on every tab of an internally approved award, for users who can edit its header. Legacy gated on the status alone.
    - Server: it reads `getSharedCustErpDetails2` (module AWARD). On DEV that returns `/UNIT4_ERP_FLOW/1.0/unit4integration`.
    - Call: it posts `{AwardId, Token}` server to server to that OIC REST flow. The flow is now a `/{flow}/{version}/{resource}` template in the generated catalogue (`RUNTIME_PATH` in `scripts/oracle-catalogue.mjs`), so only a flow path on the configured OIC host can be reached.
    - Refused, with a message: an unknown `erp_type`, which legacy ignored silently; and an address of any other shape.
    - Defect fixed in the shared OIC client: a `.` / `..` path segment was accepted and would have climbed the URL.
    - Evidence: fixtures and integration tests only. It is not run on DEV, because it hands the award to ERP.
  - **Cost delete:** deleting a cost line or a cost-period row now asks first (dialog-titles.warning, warning-messages.permanent-delete). Legacy deleted on the first click.
  - **Credit allocation:**
    - Legacy built the page but never listed the tab. DEV grants `awards-credit-allocation`, and awards carry `Award Credit Allocation` rows.
    - The tab follows Projects: Person, Project Role, Credit Allocation %, Project Effort %, and per-row Edit.
    - Save: `postProposalCreditAllocation` on the award's `proposal_period_version_id`, with `[{credit_alloc_id, credit_pct, prj_effort}]`.
    - Legacy defects fixed:
      - Add is gone: the operation updates existing rows only and ignored the person and role legacy sent.
      - Values are typed as percentages (legacy: a fraction with step 1).
      - Credit over 100% is refused, checked in basis points.
      - The lock applies.
- **Matches legacy, flagged:**
  - A header save posts AwardAmount from AwardDetails, and the audit shows that column moving (the same as legacy's own saves).
  - A team member with a date before the award start cannot be re-saved until both dates are inside the award.

### Awards listing actions — 2026-10-26

- **Built (legacy awards-start, now complete):**
  - **Create Award** (RB `create-award`): the RB-gated dialog fields with `maxLength` preferences. The org unit is the chosen PI's (legacy awPIChange); the server never takes it from the browser. With a proposal that has no award yet the backend generates it (`GenerateAward`, a GET write, now on the reviewed list); otherwise the legacy PascalCase header is posted. Empty values are left out, as legacy's undefined ones were.
  - **Clone** (RB `list-clone` + `clone`, and the `award-clone` role): legacy's parts tree with its parent/child ticking (`toggleClonePart`); parts the backend always copies start ticked and locked. Only offered parts are sent.
  - **Link**: the shared Linked Objects dialog (`features/record/linked`, `server/record/linked`), with legacy's eight module groups from the ETHICS bundle, the award itself left out, and each record's legacy link mapped to its in-app route (H26). An award with no proposal can be linked to one (legacy toasted "No Linked Data Found" and could not).
  - **Advanced Query** (RB `advanced-query`): the end drawer with attribute, operator and value, Add Condition, the read-only conditions table, and Edit and Delete. While rows exist the list reads `advanced-search`. Only probe columns (or described `attribute_N`) may be named; the column list is held per session.
- **Legacy defects fixed:** with Advanced Query rows, legacy silently dropped Proposal Name, Billing Party and Assigned To; each now applies wherever the advanced view has its column. Clone, Link and the dialogs check the award is visible to the user (AwardHeader by id) and the gate on every write.
- **Shared:** `pageAccess` and `RoleRow` moved to `platform/permissions`.
- **Evidence:** typecheck, lint (one existing warning), 754 unit/integration tests. Live DEV (reads only): create setup (123 proposals, 26 PIs, 1,706 funders, 6 currencies), clone parts (award-header fixed; projects with costs and team), links (in-app routes), and an Advanced Query `award_number` contains `2023080` (6 rows). **Not run live:** Create, Clone and Link writes (they create or change DEV records; waiting for the owner's go-ahead).

### Awards listing — 2026-10-26

- **Built:** `/awards` (legacy awards-start): status tabs, the RB-gated drawer filters (number, name, proposal, org unit, assigned to, funder, billing party, date sort, start/end date, principal investigators), list and card layouts behind `listing-card-view`, the gated record fields, the count line and Clear. Home's award-status chart opens it with `?status&org`; legacy `shell=awards` links land on it. Rows open the `awards-detail` placeholder with the legacy params (`awardHref`) until the record pages exist.
- **Server:** `awards.list` (`getPost_awardsAwardHeader`, added to the allowlist) with a server-built clause in legacy order; hidden filters cannot be applied; drawer choices load in parallel and degrade to empty with a toast.
- **Legacy defects fixed:** several principal investigators are an OR group (legacy sent `'12,34'`); text is LIKE-escaped.
- **Kept from legacy:** start and end dates match the day exactly (`$eq`); a zero amount is not shown; filters (not the date sort) outlive the page for the tab, as legacy's app-scoped `filterAwardListing`.
- **Shared:** `StatusList`, `components/ui/listing.module.css` (now also the EOI list's), `configuration/choices.ts` (status, object-date and name choices), `orgUnitRows`; `lookups.orgUnits` takes a module.
- **Opening fast:** the page renders with the bundle, status tabs and date sorts (held reference data) and the first page; org units, people and funders come from `/api/awards/choices` after it shows, as legacy loads them beside the list. `/awards` has its own loading and error boundaries, so a drawer click shows the skeleton at once (before, it showed nothing for up to a minute while DEV's org-unit read ran, and the click looked dead). Live DEV: page 0.4 s; choices 54 s cold (org units), 24 ms held.
- **Not built:** Create Award, Clone, Link and Advanced Query (writes and the end drawer); record pages.
- **Evidence:** typecheck, lint (one existing warning), Prettier, 742 unit/integration tests, the isolated production build and 15 fixture Chromium journeys (one new for Awards) pass. Live DEV: 10 of 321, Draft 10 of 133, labels and fields match VBCS side by side (Billing PARTY, no £0.00); the AWARD org-unit read timed out on DEV, as it was slow on VBCS too.

### Owner open items closed — 2026-10-26

- **Fixed:** LIKE escaping (`containsClause`), overdue on the viewer's day (`gn-tz` cookie, `viewerToday`), FX rates above 0, the cache bounded by size (64 MB), one upload per object path at a time (`exclusiveLocation`).
- **Removed:** the generated ORDS catalogue; the allowlist is the 103 operations the server names.
- **Built:** the Proposal listing's `list-*` filter gates and bundle labels.
- **Kept, with reasons:** see grantsnow-foundations.md § _Decisions 2026-10-26_.
- **Evidence:** typecheck, lint (one existing warning), Prettier, 730 unit/integration tests, the isolated production build and all 14 fixture Chromium journeys pass. Live DEV, after a fresh token: ESCAPE accepted, `total_count` filtered, no `appr_deadline_date` on the award queues.

### Proxy picker, date-picker Escape and ids — 2026-10-23

- **Proxy picker:** Profile → Manage reads an organisation's people through `people.inOrg`, read whole. `account.proxyDirectory` (first page, 25 people) is gone, and the proxy check before a status save uses the same list.
- **Escape:** the card dialogs and the Advanced filter ignore Escape while a native date picker inside them is open (`pickerOpen` in `date-input.tsx`, `input:open`). Automation cannot press keys in Chrome's native picker, so the original bug was not reproduced and the guard is unconfirmed by a real key press.
- **Ids:** the hidden native date input no longer shares `${id}-picker` with its button; it is `${id}-native`.
- **Owner (2026-10-23):** DEV records made in testing are test data and stay; nothing is deleted.
- **Evidence:** typecheck, Prettier, 711 unit/integration tests and all 13 fixture Chromium journeys pass. Lint has 0 errors and one warning, which was already there. Nothing was run on live DEV.

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
