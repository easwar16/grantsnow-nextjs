# GrantsNow VBCS → Next.js parity implementation plan

Prepared 2026-10-14 from the authenticated VBCS application, current legacy source and existing Next.js implementation. Goal: the same appearance, interaction and business/API behavior for IDCS authentication, Home/dashboard, Proposal listing and the Proposal module. This is a fidelity migration, not a redesign. All implementation stays in this Superset worktree.

## Evidence and current position

- Legacy source inspected read-only: `/Users/easwar/Developer/GrantsNow`, HEAD `b5bdcc31538ea292f2ca4ae4b09125914c2f90a5`. Do not switch/reset/update that checkout. Earlier foundation mapping used an older commit, so re-diff relevant files before implementation.
- Authenticated reference: `vbshare_621/webApps/app`, Home and Proposal listing observed. The deployed preview and current checkout are not yet proven identical; capture served source/build identity before declaring parity.
- Existing Next.js foundation has OIDC/session adapters, protected services, explicit fixtures, Home adapters, URL-query listing and prior passing tests. Those checks demonstrate foundation behavior, not VBCS fidelity or live Next.js IDCS/ORDS integration.
- Current screens require substantial changes: dashboard arrangement/visual language differs; Proposal listing uses a table instead of the observed cards/side filters; lookup/resource/field coverage and full module workflows are incomplete.
- This request expands the earlier read-only increment to a PLAN for the full Proposal module. Application implementation and live mutation testing are not performed in this planning turn. Live inspection here used navigation and opening/closing the advanced-query drawer only; no proposal saves, approvals, clones, deletes or ERP submissions.
- Evidence: `.playwright-mcp/parity-home.png` and `parity-proposals-loaded.png`. The earlier `parity-proposals.png` shows loading skeletons and is not the loaded-state visual baseline. Screenshots are local reference evidence, not public/fixture seed data.

## Observed parity requirements

| Area | Verified live/source evidence | Required change |
| --- | --- | --- |
| Theme | Header `rgb(49,83,87)` / `#315357`; body `#fbf9f8`; text `#161513`; Oracle Sans computed font, 12px body, 21px organization heading; 3px button radius | Derive tokens from live computed styles plus app.css/shell.css/redwood-overrides.css and active customer resources; retain logo/icons/compact density |
| Shell | Navigation drawer, GrantsNow logo, Help, notification badge, named user dropdown; resource/module-aware navigation | Rebuild matching shell and supported interactions; mark cross-module dependencies explicitly rather than fake functionality |
| Home | Announcements carousel/collapse, organization selector, four KPI strips; Need Attention/Insights/Opportunities/Notifications/Dynamic Charts selectors | Reproduce observed layout and configured sections; map each enabled item and interaction to its actual service/configuration |
| Attention | Full-width dense record rows, metadata separators, overdue pink background/red date/age, List View/Calendar View tabs | Replace generic dashboard cards; preserve due/pending calculations and complete event/paging/filter consistency |
| Listing | Status sidebar, category radios, inside-labelled lookup controls, collapsible filter panel, advanced-query end drawer | Replace toolbar/table layout with faithful sidebar/cards; reproduce filter application timing and query semantics |
| Records | Reference/type icon, status/risk chips, title, investigator/applicant/assignee/department/sponsor/activity/type/date/value/tag metadata, action strip | Expand allowlisted DTOs from verified fields; preserve resource visibility, currency/masking and status-dependent actions |
| Loading/counts | Initial skeletons; loaded `10 of 1415` footer; loadMoreOnScroll source | Trace loaded/filtered/global count semantics and incremental load behavior; do not simply rename page row count as total |
| Module | Source-defined tabs, dynamic forms, budget versions, locking/finalization and status/access-dependent actions | Implement shared record context and server policies before enabling edits/workflow |

Only the observed account/theme is a live baseline so far. Other roles, dark theme, small widths and Proposal/Outline/Sub/Extension variants require separate reference captures.

## Delivery order and gates

### Phase 0 — Freeze the parity specification

1. Build a screen/state register from the existing migration artifacts, limited to the requested scope, not all 111 application screens.
2. For each screen record: source HTML/JSON/JS/action chains/fragments; resource keys; endpoint/method/headers/query/body/response/error; permissions/status/finalization/lock rules; visible states; screenshot and keyboard behavior.
3. Capture stable desktop/narrow-width reference screenshots, loading/empty/error states, menus, dropdowns, drawer/modal dimensions, focus/escape/tab behavior, formatting and animation. Use sanitized fixtures for repeatable visual tests; do not copy real user/session data into fixtures.
4. Compare served VBCS build with the checkout, then flag discrepancies. Product owner chooses authoritative behavior where branches differ; do not unknowingly port an unrelated legacy ticket.
5. Audit reusable assets/font/icon licensing and availability in source. Run a small feasibility spike for exact lookup/calendar/chart behavior: prefer React components that reproduce the observed contract; use isolated Oracle JET wrappers only if official supported integration provides materially better parity. Do not install a competing UI stack speculatively.

Gate: every requested screen/action has a traceable entry; unknowns are explicit. No styling redesign is accepted as parity.

### Phase 1 — Real IDCS authentication + GrantsNow session

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

### Phase 2 — Shell/component parity and dashboard

1. Build reusable parity primitives: compact buttons/icon buttons, inside-labelled text/select/LOV controls, date picker, multi-select tags, status/risk chips, record metadata rows, drawers/dialogs, validation summaries, toasts, tabs, skeletons, scrolling/paging and accessible focus behavior.
2. Rebuild header/logo/navigation/user menu and active-route behavior from shell-page/fragments; integrate live session/resources. Preserve permission-aware visibility and direct-request checks.
3. Match Home organization selection, announcements behavior, KPI strip and dashboard section navigation. Trace current KPI chains `load_KPI_from_api.json` and `fetchKPIdata.js`; identified operations include getSharedBidSuccessRate, getSharedAwardYOY, getSharedVarianceCostAward, getSharedVariancePriceAward and getSharedGetKpiStatistics. Reconcile which chain/config powers each live display before using values or formulas.
4. Rework existing nine attention adapters into matching rows and implement their verified fields/date/status rules. Add calendar behavior with complete event consistency across filters/loading; no partial calendar presented as complete.
5. Reproduce chart type, series, palette, legends, tooltips, date filters and drill-down semantics. Existing eight adapters are a starting point, not complete insight parity. Map dynamic charts/opportunities/notifications and their Home-only interactions separately from rebuilding their destination modules.
6. Treat real read APIs/business errors independently per widget and compare with VBCS using known DEV records.

Gate: same enabled Home sections, labels, values and permitted drill-downs; reviewed screenshot differences at identical viewport/theme/data; keyboard and failure states verified. Out-of-scope destination modules remain explicitly tracked dependencies.

### Phase 3 — Proposal listing parity

1. Keep `apps/getPre_awardGetProposalsList` GET `/pre_award/getProposalsList/`; reconcile current provider/fetch chains/transforms, ORDS q expressions, sort, loadMoreOnScroll and totals. Preserve API semantics while URL state supports reload/back/forward.
2. Render the observed record cards rather than a substitute table. Match reference/type, status/risk, title, metadata order/wrap/separators, dates/value/tags, hover/focus and action placement.
3. Build left status tabs and category selectors covering actual Proposal/Sub-Proposal/Outline/Extension codes. Existing Next.js two-type enum is insufficient; verify source codes before expanding it.
4. Implement real investigator/department/sponsor/assignee/activity/proposal-type/tag lookup selectors, typed ID/value binding, date controls and clear behavior. Replace code-entry placeholders with verified LOV contracts.
5. Implement the advanced-query **end drawer** (not modal): source allowlisted attributes/operators/types, add/edit/remove condition behavior and exact legacy transform; never pass unrestricted user expressions to Oracle.
6. Keep row reads authorized; preserve resource-hidden fields and object/action scopes. Show loading/empty/failed/session-expired states distinctly; latest-request protection applies during filter resets and incremental loads.
7. Implement listing action surfaces when their Phase 4 workflows are functional: create Grant App/Outline, link/share, clone, delete and recycle/restore. Do not show inert controls as completed parity.

Gate: identical record set/ordering/visible fields/counts for a matrix of filters and categories; same observable interaction and visual layout; no unauthorized direct API reads/actions; scroll/filter/back/reload and cancellation tested.

### Phase 4 — Full Proposal module in vertical slices

First implement record context: `/proposals/[type]/[id]`, header/status/actions, configured tab names/order, object permissions, editable statuses, finalization/locks, budget selection and unsaved-change navigation. Recheck summary operation `apps/getProposalProposal_id`; lock/finalization source includes `apps/postProposalInsertModuleLock2`. Permission flags must be checked server-side as well as reflected in UI. Legacy getTabs permits tabs when access is absent; reconcile this with explicit fail-closed authorization rather than copying the exception blindly.

| Slice | Source-backed scope | Acceptance focus |
| --- | --- | --- |
| 4A Core lifecycle + Summary | Proposal/Outline creation, summary fields/LOVs/investigators/sponsors/deadlines/tags, edit/save/cancel, links/share/clone, type conversion and Sub/Extension flows where source permits | Required/hidden/readonly fields, approved status transitions, save failure retention, exact payload, fresh-read persistence |
| 4B Budget + Pricing | Cost lines/periods, indirects, cost models/rates/currency, versions/create/clone/delete, research partners, in-kind, allocation for credit, FEC summary, pricing | Exact financial precision/rounding/period/currency/version/finalization rules; backend remains calculation authority where applicable |
| 4C Dynamic forms + compliance | Five configured dynamic-form flows; ethics, due diligence, sponsor due diligence; metadata-driven labels/validation/visibility/attachments | Customer-specific form configuration and persisted answers; don't replace with hardcoded sample forms |
| 4D Documents + related records | Attachments/upload/download/preview; linked Contracts/Awards views | Permissions, allowed files/size, preview/download behavior, relation navigation; related modules are dependencies, not automatically rebuilt wholesale |
| 4E Approval + completion | Approval chains/actions, delegation, history/audit, rework/rejection/finalization, sponsor/ERP handoff as source allows | Correct workflow actor/stage/status, locking/concurrency, backend error handling and side-effect boundaries |
| 4F Recycle/restore + parity closure | Soft-delete/recycle/restore, remaining lifecycle actions and every registered enabled tab/state | Confirm recovery semantics/permissions, no premature irreversible actions, complete matrix/UAT |

Source getTabs enumerates 21 flows: Summary; Budget; Pricing; Dynamic Forms 1–5; Allocation for Credit; Budget Research Partner; In-kind Contribution; FEC Summary; Ethics; Due Diligence; Sponsor Due Diligence; Contracts; Attachments; Awards; Approvals; History; Delegation. Actual names/visibility are resource/access-driven. These are source-verified inventory entries, not claims that all were inspected live today.

For each slice: trace chains/contracts → capture reference behavior → implement server service/schema/policy → implement matching UI → failure-mode tests → disposable DEV persistence tests → visual/business UAT. Mutation testing needs a designated nonproduction dataset and agreed reset procedure; no live destructive/approval/ERP effects are authorized merely by browser access.

## API and implementation boundaries

- Reuse existing Oracle/ORDS/OIC APIs; no replacement backend or guessed endpoints. Maintain a contract register including operation ID, configured destination, proxy/auth needs, all inputs/outputs/business errors, client DTO and source evidence.
- Next server handles auth/secrets/tokens/Oracle transport. Browser receives minimal display data and verified action capabilities. Initial Server Component reads call server services directly; browser interactions use protected handlers sharing those services.
- Retain the current folder conventions; expand Proposal subfeatures around actual responsibilities. Separate identity/session, server query state and local draft/dialog state. Don't recreate VBCS global variables as one React singleton.
- Request cancellation, save single-flight behavior, stale-response protection, backend validation errors, navigation guards and lock cleanup are implementation requirements, not visual polish.
- Accessibility should preserve familiar keyboard behavior while correcting accidental defects; document intentional deviations instead of silently changing business behavior or reproducing unsafe authorization.
- Azure portable Node deployment remains the target. No Vercel-only integration, static export, provisioning or deployment is part of this plan.

## Missing inputs and decisions

1. Dedicated IDCS client ID/secret or approved key mechanism; exact client auth method/scopes; username claim/case mapping; registered callback/logout URLs. Public metadata is now verified, but actual tokens/client compatibility are not.
2. DEV ORDS base/apps destinations and authorized replacement for VBCS proxy credentials/network; confirmation of token expiry, renewal/revocation/row scope and successful response shapes. Supply secrets privately through ignored env/settings.
3. Authoritative served build/branch and target customer resource/theme; allowed/denied accounts and role matrix; configured tab names/visibility.
4. Disposable DEV Proposal/Outline/Sub/Extension records and workflow participants for permitted mutation tests, including attachment and OIC side-effect policy.
5. Review criteria for exact visual parity and explicitly accepted differences, including mobile, dark theme, font/icon licensing and known legacy bugs.

## Completion evidence per phase

Automated type/lint/unit/integration/build checks; real DEV service acceptance when configured; isolated Playwright failure/keyboard/navigation tests; visual screenshot comparison with identical data/theme/viewport and animation settled; reviewed list of deviations. A phase is not complete from fixture screenshots alone. Record coverage and blockers in implementation-status.md and the existing Obsidian context.

Suggested team ownership for the two UI/two AI developers: UI1 shell/components/Home; UI2 listing/record screens; AI1 identity/session/API/policy contracts; AI2 legacy trace/fixtures/tests/parity register. These are project responsibilities, not agent delegation. Deliver sequential phase gates with coordinated contract/component review.

Official references: [Next authentication](https://nextjs.org/docs/app/guides/authentication), [openid-client discovery](https://github.com/panva/openid-client/blob/main/docs/functions/discovery.md), [library source/docs](https://github.com/panva/openid-client), [Oracle web application authorization](https://docs.oracle.com/en/cloud/paas/identity-cloud/idcsa/ACWebServerAppAuth.html).
