# GrantsNow rebuild: development checklist

The one list of what is built, how it was tested, and what is left. `docs/progress.md` holds the narrative;
`docs/changes/` holds each change; this file holds the state.

**Every session:**

1. **At the start**, read this file after `AGENTS.md` and `docs/agent-guide.md`. Then:
   - check the legacy watermark below: run
     `git -C ~/Documents/Projects/GrantsNow log --oneline <watermark>..origin/development` and the KB's
     `KB-Meta.md` changelog for anything newer, and add each new ticket to **Legacy tickets to carry**;
   - **check whether the GrantsNow KB was updated** (owner, 2026-11-04; on Titiksh's machine,
     `~/Documents/Projects/Obsidian/GrantsNow/KB-Meta.md`): compare its learning watermark and changelog with the KB
     watermark below. For each new entry, update the affected rows here (a changed legacy behaviour reopens a ✅ row)
     and add its tickets, then move both watermarks;
   - pick the next item from **Next up**.
2. **When something is built or tested**, update its row here in the same change: the status, and the evidence
   (fixture, live read, live write) with the date. Never mark ✅ on fixtures alone.
3. **At the end**, move finished items out of **Next up** and set the next one.
4. **Live DEV writes:** DEV data is test data (owner, 2026-11-03). Records and values a live write test creates or
   changes stay as they are: no deleting, no reverting. Side effects that reach people (Submit for Approval, sending
   e-mail, ERP) still need the owner's go-ahead.

Status: ✅ built and verified on live DEV · 🟢 built, fixtures only · 🟡 partly built · ⬜ not started ·
⛔ waiting on the owner or the backend · — not applicable to the rebuild.

**Repo base:** `origin/main` `4542021` (rebased 2026-11-10).

**Legacy watermark:** `origin/development` `a8c3e2938` (2026-11-10, read 2026-11-11), `origin/uat` `3f38fdc3d`.

**KB watermark:** `KB-Meta.md` changelog entry "2026-11-10 (catch-up `97e90299e..9cb7da90a` dev …)", read 2026-11-11.
The KB has not read `9cb7da90a..a8c3e2938` (9568, 8483, 9382) yet; the rebuild read those commits from source.

## Next up

Owner order (2026-11-03): Easwar's modules (Proposals, Contracts) are left for now. First finish what is partly done,
then what waits on the backend, then Claims again.

1. **Waiting on the owner:** Guided Learning text to the RB (owner: literal until the feature is complete).
2. **Waiting on the backend:** Linked Objects 70 s, Awards listing 21 s unfiltered, contract read 78 s (re-tested
   2026-11-03); a second `POST /dynamicForms/dynFormResponse` on an EOI leaves no answers, VBCS 621 too (2026-11-11);
   Claims roster credential upload needs OIC.
3. **Done in our modules (2026-11-10/11):** Claims (MR 15893 parity, Activities, Amendments, Roster, Equipment,
   requirements, approvals, Claims tab), 9305 Award Project Costs, 9568, 9284 and live EOI Submit.
4. **Later (Easwar's modules):** guide §10 moves, Proposals and Contracts items below; the duplicate API operations
   merged 2026-11-11.

## Platform and shell

| Item                                                     | Status | Evidence / note                                                                                                                                                      |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDCS OIDC login (library-verified), sealed session       | ✅     | Live on Azure 2026-11-04 (owner); straight to IDCS; local callback not registered yet                                                                                |
| DEV browser-session bridge (loopback only)               | ✅     | Live DEV reads since 2026-10-14                                                                                                                                      |
| Oracle API layer, allowlist, undici pool, read retry     | ✅     | Live soak 2026-10-23                                                                                                                                                 |
| Session-held lookups and org units (`ttl.session`)       | ✅     | 2026-10-29                                                                                                                                                           |
| Navigation drawer (VBCS order), placeholders for unbuilt | ✅     | 2026-10-14 / 10-29                                                                                                                                                   |
| User menu, profile, preferences, themes, proxy picker    | ✅     | Live vs 621 2026-11-05: Preferences drawer (width, swatches, switches, sticky Save) and Manage profile Preference (combobox) / Manage (inside fields) by measurement |
| Header Help and notifications controls                   | ✅     | Live 2026-11-05: Help → Tutorials; bell lists live notifications by day                                                                                              |
| Guided Learning (driver.js)                              | 🟢     | Auto tour recorded on start, not only on a clean close (it returned every login), 2026-11-10; guide text to the RB later                                             |
| Chatbot                                                  | ✅     | Sent live 2026-11-05: user bubble with time, bot menu reply                                                                                                          |
| Docker image                                             | ✅     | Running on Azure `gn-migration-ca` 2026-11-04; one `.env.<env>`, secrets not baked; `scripts/docker.sh help`                                                         |
| IDCS sign-out (`id_token_hint`)                          | ✅     | Fixed 2026-11-04 after IDCS 400 on Azure; released and confirmed on Azure by the owner 2026-11-10                                                                    |
| ORDS client credentials (`ORDS_AUTH_MODE=oauth`)         | ✅     | DEV `dev_base` and `dev` tokens 2026-11-04; Azure sign-in uses it                                                                                                    |
| Production deploy / hosting review (fonts, CDN)          | ⛔     | Owner                                                                                                                                                                |

## Shared record framework

| Item                                                           | Status | Evidence / note                                                                                                                                                                               |
| -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RecordFrame` (panel, tabs, Finalize, edit-mode hides panels)  | ✅     | Awards, EOI, Claims Funds, Claims Unit; tab bar is the shared `RecordTabs` (also Proposals, Contracts) 2026-11-03                                                                             |
| Comments (@mentions), Audit trail                              | ✅     | Live award 1183, EOI                                                                                                                                                                          |
| Audit: MIME description for `DOCUMENT_TYPE`/`FILE_TYPE` (5980) | ⬜     | Legacy uses it in Ethics/DD only; carry when those are built                                                                                                                                  |
| Attachments (folders, upload, preview, links, delete)          | ✅     | Live OIC 2026-10-23; detail pane pitch as 621, no Download button (legacy) 2026-11-03                                                                                                         |
| Approvals (route, stages, Generate, Submit, verdicts, graph)   | ✅     | Live 2026-11-11: Generate, Submit and every verdict — Approve (EOI 4076), Reject (4094), Rework (4095) — with history and comments; status writes drop the held record state for every module |
| History (Add Status, Abandon), Delegation                      | ✅     | Live award 1183, EOI 4034                                                                                                                                                                     |
| Dynamic forms (create, save, required, finalize)               | ✅     | Live EOI 3954; 9408 (async checkbox `required`) — n/a, check once                                                                                                                             |
| Dynamic forms: stakeholder id wait (9331)                      | —      | Legacy binding race; the rebuild passes the id with the form                                                                                                                                  |
| Object attributes (LOV value not among options shows blank)    | ✅     | Live 2026-11-03: award 1190 Attribute 3 saved and persisted (backend persists now)                                                                                                            |
| Linked objects ("Link to")                                     | ✅     | Live 2026-11-03: award 1188 Linked Objects opened (proposal, award, contract); backend 70 s                                                                                                   |
| FX rates                                                       | 🟢     | Built, not mounted (Proposals)                                                                                                                                                                |
| One dialog frame (`ActionDialog`: `help`, `dismissible`)       | 🟢     | Every modal on it except the nav drawer and chatbot window, 2026-11-03                                                                                                                        |
| Creator card (`CreatorLink` / `personCard`)                    | ✅     | Awards, EOI                                                                                                                                                                                   |
| Report files (`fileRoute`, `download`, `reportPayload`)        | ✅     | Proposals Print, Claims Export                                                                                                                                                                |

## Home

| Item                                                        | Status | Evidence / note                                                                                                                         |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Organization heading, announcements carousel                | ✅     | `docs/home-coverage.md`                                                                                                                 |
| KPI strip, sparklines                                       | ✅     | Live                                                                                                                                    |
| Nine Need Attention queues (paging, overdue, links)         | ✅     | `appr_deadline_date` not yet seen in a live payload                                                                                     |
| Chart legend: HTML, one width, scrolls, toggles series      | ✅     | Live Home and Analytics 2026-11-03                                                                                                      |
| Insights: 15 panels, filters, drill                         | ✅     | Drill live 2026-11-03: Proposals by Year 2026 Closed Funded → 151 rows, same as 621. FOS HTTP 555 on DEV (621 shows no data)            |
| Dashboard tabs (five configured), dimension preference save | ✅     | Live 2026-11-10: Dimension save posts legacy body, invalidates the cached read; DEV does not persist dimensions (621 the same: backend) |
| Calendar view                                               | ✅     | Colours, heights within 1px of 621 (FullCalendar, legacy fp-cal palette) 2026-11-03                                                     |

## Opportunities and EOI

| Item                                                             | Status | Evidence / note                                                                                                                         |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Finder (filters, Advanced filter, cards, dialogs)                | ✅     | Live 2026-10-22; Advanced filter not in the URL, as legacy manageFilterURL (six keys)                                                   |
| Share, Convert, Comments, deadline-warning dialogs               | 🟡     | Share/Convert live; deadline warning live 2026-11-10 (opp 6932791, 30-day window); Comments hidden: RB `share-comments` N (owner rule)  |
| Bookmarked / Shared tabs, narrow screens                         | ✅     | Live 2026-11-05 = 621: Bookmarked 0, Shared the same 5 in order; 390px e2e 2026-11-03                                                   |
| Analytics dashboard                                              | ✅     | On the shared chart: panels 818×619 as 621, rotated labels, inside %; DEV's unlabelled row drawn. Legend title not shown                |
| EOI list                                                         | ✅     | Live                                                                                                                                    |
| EOI record: Application, forms, attachments, history, delegation | ✅     | Live 3954                                                                                                                               |
| EOI record: workflow Submit                                      | ✅     | Live 2026-11-11: EOI 4076 (AOI_524) generated and submitted, Awaiting Internal Approval; create was broken by 9284 (HTTP 405) and fixed |

## Proposals (Easwar's module)

| Item                                                          | Status | Evidence / note                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing (cards, statuses, filters, scroll paging)             | ✅     | Fixture browser journey; native date inputs remain (self-check)                                                                                                                                                                             |
| Listing: Create / Copy (8563 cascade) / Recycle / Share       | 🟡     | Easwar 2026-11-02, fixtures; Advanced Query too; no live write                                                                                                                                                                              |
| Record shell on `RecordFrame`                                 | 🟡     | Shared tab host used; full module parity still pending                                                                                                                                                                                      |
| Summary view and edit (sponsors, PI, partners, deadlines)     | 🟡     | Easwar 2026-10-27                                                                                                                                                                                                                           |
| Budget (versions, staff), FEC summary, quick cost             | 🟡     | Staff/nonstaff fixture save journey; 9305 expansion not carried; Add Cost RB-gated and hidden without rights 2026-11-10; staff entry page not on RB labels (guide §12) |
| Generated Staff/Student/Pool Tech line edit and save          | 🟡     | 2026-11-10: scoped header/version/category, calculation and explicit save; four unit cases and fixture browser failure/retry. Salary/indirect fields and live write remain.                                                                 |
| Proposal Dynamic Forms 1–5 guarded Submit                     | 🟡     | 2026-11-10 P_6455 Detail and empty Commentary compared from live screenshots. Detail checkbox choices now stack vertically; GRID spans the VBCS full row, Submit is centered and desktop toolbar shares List's row. Empty Commentary hides both placeholder and Submit, uses read-only budget-version text and page-specific Finalize visibility. Fixture browser checked populated POST and empty display. Post-correction live comparison, other variants, files and live write remain. |
| Pricing (9382 combined per partner, 9410 fixed layout)        | 🟡     | 2026-11-10 live P_6455 split/combined and EUR compared; Proposal Number column, currency control, tab underline, collapsible groups and partner-free Combined edits implemented. Next DEV zero-value Combined Staff Save and fresh read passed. Global Save, institution editing and combined research-partner grouping still lack live acceptance. |
| Allocation for credit, contracts (where-clause fixed), linked | 🟡     | 2026-11-10 Credit Allocation row Edit/Save checks active version, rows, role, lock and 100% total. P_6455 screenshot exposed a detached editor; it now edits inline in the shared table, with sort controls, pinned cells, failed-save retry and Escape cancel. Focused fixture browser passed. Post-change live view and persisted Oracle write/read remain. |
| In-kind Contribution                                          | 🟡     | 2026-11-10 route, sponsor total and existing line Edit/Save/Delete use scoped reads and exact ORDS envelopes; three unit cases and fixture browser failure/retry pass. Add needs the missing cost-item line ID from a live source response. |
| Print (`report_code` = page name, fixed)                      | ✅     | 2026-10-30                                                                                                                                                                                                                                  |
| Approvals, attachments, history, delegation (shared hosts)    | 🟡     | Host adapters still flat in the server folder                                                                                                                                                                                               |
| Ethics / Due Diligence tabs                                   | 🟡     | Modules started 2026-11-03 (listing, draft, overview); see below                                                                                                                                                                            |

## Awards

| Item                                                           | Status | Evidence / note                                                                                      |
| -------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Listing (status tabs, drawer filters, cards/list)              | ✅     | Live 2026-10-26                                                                                      |
| Listing actions: Link, Generate Award                          | ✅     | Live 2026-10-30                                                                                      |
| Header (panel, dynamic form, Save Header)                      | ✅     | Live 1176; Save Header 2026-11-02                                                                    |
| Header: Created by = `created_by` (9412)                       | ✅     | Live 2026-11-03: award 1190 (PI Titiksh) shows Brock Philips, as 621                                 |
| Header dates and back-to-proposal after refresh (9326)         | ✅     | Rebuild reads periods and `proposal_id` on every load                                                |
| Budget periods, Projects (add/edit), Project Costs             | ✅     | Live 1176                                                                                            |
| Project Costs tree start depth (9305)                          | 🟢     | 2026-11-11: `AWARD_PROJECT_COSTS_EXPAND_LEVEL` → `DataTable` `openDepth`; the variable is not on DEV yet (all open)                                                                                    |
| Credit allocation, Installments, Milestones, Report            | ✅     | Live 1176                                                                                            |
| Dynamic forms 1–5, Attachments, Approvals, History, Delegation | ✅     | Shared hosts                                                                                         |
| Due Diligence tab (list), Create Governance                    | ✅     | Live 2026-11-11 after the rebase: shared `ParentDueDiligence` as legacy (dialog, card open per access view); Create from 1190 → DD_403 linked and listed; Link and View hidden as on 621. Admin answer on create and `READONLY_ACCESS` view open for Easwar (guide §13) |
| Send to ERP                                                    | 🟢     | Wired as legacy 2026-11-11 (any reader of an internally approved award; custErpDetails → OIC flow); **manual testing by the owner**, not run live                                                      |

## Ethics and Due Diligence (Easwar's modules)

Supervisor lookup correction, 2026-11-11 (fixture only): `Not Applicable` sentinel rows lacking Org Unit are excluded from Due Diligence supervisor choices and both modules’ setup edit validation. Four previously failing fixture Chromium journeys passed after the fix; live Oracle acceptance remains open. See `docs/changes/2026-11-11-easwar-supervisor-sentinel.md`.

| Item                                                  | Status | Evidence / note                                                            |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Listing (access views, filters, paging, recycle)      | 🟢     | DD clone/delete/linked records added; fixtures only, no live read; 2026-11-11 live (Ethics, DD): layout as 621, shared card; Ethics Link, Clone (ETH_2693) and Delete live; the Ethics recycle bin is empty in VBCS too (backend) |
| New (general overview setup draft)                    | 🟡     | DD dynamic form, submit and edit built; live write unverified              |
| Record overview                                       | 🟡     | DD child tabs now route on `RecordFrame`; version preview remains open     |
| §4 structure, `TabBar`, own DD CSS                    | 🟢     | 2026-11-04 (owner), fixtures                                               |
| Responses, reviewers, approvals, attachments, history | 🟡     | DD child hosts built, fixture only; historical response preview still open |

Due Diligence 2026-11-10 update (fixture only): scoped listing, clone/delete/recycle, configured create/submit/edit, response Edit/Save/Cancel and historical versions, Documents, Approvals, History, comments/audit, Proposal/Award and detail reference links, print and finalize paths are built. Twelve focused Playwright journeys passed, including both parent types, as did 958 unit/integration tests, typecheck, lint and isolated build. Keep the module 🟡: browser-history edit guard and live DEV contract/visual checks remain open. See `docs/changes/2026-11-10-due-diligence-module.md`.

Ethics 2026-11-10 update (fixture only): participant-scoped tabs and deep links, setup create/submit/draft and guarded force edit, configured attributes, admin answer on creation, dynamic Responses with Edit/Cancel and historical read-only preview, Documents, Approvals and automatic submission gate, History, comments/audit, clone/delete, linked records, reference link/unlink, print and finalize paths are implemented. 958 unit/integration tests, typecheck, lint, isolated build and 17 Ethics fixture browser journeys pass. Keep the module 🟡 pending live DEV contract reads and role/record-type visual acceptance. See `docs/changes/2026-11-10-ethics-module.md` and `docs/ethics-source-inventory.md`.

## Contracts (Easwar's module)

| Item                                                    | Status | Evidence / note                             |
| ------------------------------------------------------- | ------ | ------------------------------------------- |
| Listing                                                 | 🟡     | Date filters still native inputs (guide §8) |
| Record: summary, workflow, signers, history, delegation | 🟡     | Shell not on `RecordFrame` (guide §10)      |
| Summary: editable Contract Detail form                  | ⬜     | Guide §8                                    |
| New Contract: Create on the shared `DynamicForm`        | ⬜     | Guide §8                                    |
| Signers: request by email posts status `SUB` (8798)     | ⬜     | Not built                                   |

## Claims

| Item                                                         | Status | Evidence / note                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit Inquiry listing (filters, create/update, Clone, Export) | ✅     | Live 2026-10-30; MR 15893 card body (fund dots, counts, Activities link) = 621, live 2026-11-10                                                                                                                                                                                                                                                                                                                                                                       |
| Funds Inquiry listing                                        | ✅     | Live 2026-10-30                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Funds record: Summary, Budget, Claims, Attachments, Export   | ✅     | Live fund 641/521                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Funds record: approvals, awards, dynamic forms flows         | —      | Unreachable in legacy: getTabs lists summary, budget, claims, attachments only (KB GrantsNow-Claims, checked 2026-11-11)                                                                                                                                                                                                                                                                                                                                              |
| Unit record: shell and panel                                 | ✅     | Live app 1130 vs VBCS 621                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Unit Summary: Fund Summary, Preparer/CFO, Signed Off, Terms  | ✅     | MR 15893 7-column fund table, Key Dates, Terms collapsed; live app 1065 2026-11-10                                                                                                                                                                                                                                                                                                                                                                                    |
| Unit Summary: Edit / Save (`putAppSummary`)                  | ✅     | Live write 2026-11-03 on app 1065 (persisted; same in 621)                                                                                                                                                                                                                                                                                                                                                                                                            |
| Unit Summary: allocations, stakeholders, meetings, documents | ✅     | Live 2026-11-03 on 1065: allocations, stakeholders, meetings + file, documents + file, delete                                                                                                                                                                                                                                                                                                                                                                         |
| Unit Summary: stakeholder exports, Assurance, audit buttons  | ✅     | Live 2026-11-03: export, Assurance submit (req 785), allocations audit                                                                                                                                                                                                                                                                                                                                                                                                |
| Unit Summary: grant category columns per fund line (9342 v2) | —      | Not on legacy `development` yet (uncommitted on `Claim_DEV_Beta`)                                                                                                                                                                                                                                                                                                                                                                                                     |
| Unit record: Goals, Attachments, Activities, Claims          | 🟡     | Goals ✅; Attachments ✅; Activities 🟡: fund bar + side panel; Add / Edit activity and Delete live 2026-11-10; Amendments (include, add, save, deletes) live app 384 2026-11-10; approvals (fund / amendment / activity / roster) live 2026-11-10; Roster and Furniture & Equipment live app 384 2026-11-10 (credential upload ⬜, needs OIC); requirements live apps 384 / 1164 2026-11-10; Claims tab live app 384 2026-11-10 (claim 2 and adjustment 604 created) |
| Unit record: approvals                                       | ✅     | Fund, amendment, activity, roster on the shared `ApprovalWorkflow`; live app 1164 2026-11-10 (Submit generated and posted; FPCG014 refusal rolled back)                                                                                                                                                                                                                                                                                                               |

## Not rebuilt (navigation placeholders)

Reports (external), Announcements, Administration, Customer Support, API docs, Tutorials, Notifications: ⬜.
(Ethics and Due Diligence are started: see their section.)

## Legacy tickets to carry

New tickets from the KB catch-ups, and what each means for the rebuild.

| Ticket | Legacy change                                                                                      | Rebuild                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9412   | Award "Created by" is `created_by`, not the PI                                                     | 🟢 2026-11-03 (`awards/record.ts`, `shell.ts`, `creator.ts`)                                                                                                          |
| 9326   | Award header dates and parent proposal after a refresh                                             | — already so                                                                                                                                                          |
| 9305   | Costing trees open to a configured depth (3 global variables)                                      | Awards 🟢 2026-11-11 (`DataTable` `openDepth`, `functions.tables.expandDepth`); Proposals Budget/Pricing ⬜ (Easwar)                                                  |
| 9382   | Combined Pricing per research partner, read-only with partners                                     | 🟡 Combined parent/subproposal live; research-partner grouping not accepted (Easwar) |
| 9410   | Pricing table fixed layout                                                                         | 🟡 P_6741 and P_6455 live table comparisons (Easwar) |
| 8563   | Copy Proposal dialog parent/child cascade                                                          | ⬜ with Copy Proposal                                                                                                                                                 |
| 9554   | Insights: three grant-category charts take Year/Quarter/Month                                      | — already so: every Insights widget sends year/quarter/month                                                                                                          |
| 9555   | ✅ 2026-11-05                                                                                      | legend Submitted/Awarded by `status_code` live; title seed updated (DEV RB row still says "Proposals by Year")                                                        |
| 9319   | — already so                                                                                       | `ReadonlyField` = 621 by measurement 2026-11-05 (pre-wrap, 408 vs 410 wide, 30px for two lines)                                                                       |
| 8483   | 🟢 2026-11-05                                                                                      | upload/delete toasts from the record bundle with legacy fallbacks; upload not run live (OIC not connected locally)                                                    |
| 9410+  | `COMBINED_COLLAB_SPLIT` global: Combined view partner split                                        | ⬜ Proposals Budget/Pricing (Easwar)                                                                                                                                  |
| Claims | Claims redesign merged (MR 15893): fund bar, 8-col Summary, …                                      | ✅ compared and built 2026-11-10 (`docs/changes/2026-11-10-titiksh-claims-redesign-live-pass.md`); live on DEV                                                        |
|        | unit-card links, activity/claim drawer; 9342 additional                                            | "Claims redesign brought into VBCS"                                                                                                                                   |
| 8798   | Contract signer request posts `SUB`                                                                | ⬜ with Signers request                                                                                                                                               |
| 5980   | Audit drawer shows MIME descriptions                                                               | ⬜ with Ethics/DD                                                                                                                                                     |
| 9408   | Required checkbox raced the save validation                                                        | — React validates in the same render; recheck with a live form                                                                                                        |
| 9331   | Dynamic form waits for the stakeholder id                                                          | —                                                                                                                                                                     |
| 9328   | Ethics tab the user cannot read redirects within the app                                           | ⬜ with Ethics                                                                                                                                                        |
| 9342   | Grant category per fund line (v2)                                                                  | — not on `development` yet; carry when it lands                                                                                                                       |
| 9172   | `DEFAULT_DATE_FORMAT` lower case (JET minutes) — reverted                                          | — the rebuild formats with moment, which upper-cases it                                                                                                               |
| 9549   | 🟢 2026-11-05                                                                                      | `sizeNotice`, file name in the warning; not seen live (OIC not connected locally)                                                                                     |
| 9548   | ✅ 2026-11-05                                                                                      | live: both year charts show only 2025 with Years = 2025; refresh already so                                                                                           |
| 9558   | Read-only JET controls compacted (CSS)                                                             | — the rebuild uses `ReadonlyField`                                                                                                                                    |
| 9559   | Proposal finalize refused while the dynamic form misses mandatory fields                           | ⬜ Proposals (Easwar); RB `finalize-mandatory-fields`                                                                                                                 |
| 9545   | No View Approvers on sub-proposal stages of a parent proposal                                      | ⬜ Proposals approvals (Easwar)                                                                                                                                       |
| 9146   | Proposal create/summary label layout                                                               | ⬜ Proposals (Easwar)                                                                                                                                                 |
| 9390   | History fragment loads when the host passes its id late (cold entry)                               | — the rebuild reads history on the server with the record's id                                                                                                        |
| 9568   | 🟢 2026-11-11                                                                                      | Home KPI `academic_year_vs_cost` cut to whole pounds (`functions.format.wholeAmount`); DEV's KPI_STATISTICS does not enable that KPI, so it cannot be seen live there |
| 9284   | ✅ 2026-11-11                                                                                      | EOI insertRequest POST upsert with the attributes, attributes editable, type `OPPORTUNITIES-EOI`; live create, attribute save and Submit on DEV                       |
| 8483   | Proposal listing Delete dialog: `listing-delete-warning` title and `listing-permanent-delete` text | ⬜ Proposals (Easwar)                                                                                                                                                 |
| 9382   | Pricing blank fix (`proposals-pricing-start-page.js`, CSS)                                         | ⬜ Proposals (Easwar), with the 9382 row above                                                                                                                        |
| Awards | Project Cost fix (`b022e2f5e`): item fills `gl_nominal_code`, NaN totals                           | — already so (code field; new line's split starts at 0). Legacy dropped the GL Nominal RB gate: kept fail-closed                                                      |
| Awards | Period fix (`9cb7da90a`): `periodDetails` in the header event payload                              | — VBCS event typing                                                                                                                                                   |
| 5980   | Ethics/DD audits: history page uses the first stakeholder (Individual)                             | ⬜ Easwar: `ethicsPanelHost` uses the stakeholder on every non-overview page, legacy only for `Individual` types, and the setup id on Responses                       |
