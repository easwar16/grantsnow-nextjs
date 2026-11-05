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

**Repo base:** `origin/main` `118d553` (rebased 2026-11-04).

**Legacy watermark:** `origin/development` `97e90299e` (2026-11-04), `origin/uat` `3f7205c01`.

**KB watermark:** `KB-Meta.md` changelog entry "2026-11-04 (catch-up `2a12e5f95..97e90299e` dev; uat unchanged)",
read 2026-11-04.

## Next up

Owner order (2026-11-03): Easwar's modules (Proposals, Contracts) are left for now. First finish what is partly done,
then what waits on the backend, then Claims again.

1. **Deployment (2026-11-04):** release the image with the sign-out fix and test sign-in/out on Azure; store the
   secrets in the Container App (`scripts/docker.sh azure-secrets dev`) and delete image `0.1.0` (secrets baked in);
   the localhost callback on the IDCS client.
2. **Waiting on the backend:** re-tested 2026-11-03 and reported
   for the backend owner: Linked Objects 70 s, Awards listing 21 s unfiltered, contract read 78 s (org units now 3.1 s).
3. **Claims:** first compare the built Claims pages with the legacy Claims redesign (MR 15893, 2026-11-04; see
   Legacy tickets). Activities slice 1 (header, Fund Summary, Activities List, Delete) and 2a (View, versions, sub-tabs)
   are built and live-read on DEV (Delete still to run live); then 2b (Add / Edit activity, goals, cost items), slice 3 (amendments, roster, equipment,
   requirements), slice 4 (approvals); then the Claims tab; 9305 on Award Project Costs.
4. **Later (Easwar's modules):** guide §10 moves, Proposals and Contracts items below.

## Platform and shell

| Item                                                     | Status | Evidence / note                                                                                                           |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| IDCS OIDC login (library-verified), sealed session       | ✅     | Live on Azure 2026-11-04 (owner); straight to IDCS; local callback not registered yet                                     |
| DEV browser-session bridge (loopback only)               | ✅     | Live DEV reads since 2026-10-14                                                                                           |
| Oracle API layer, allowlist, undici pool, read retry     | ✅     | Live soak 2026-10-23                                                                                                      |
| Session-held lookups and org units (`ttl.session`)       | ✅     | 2026-10-29                                                                                                                |
| Navigation drawer (VBCS order), placeholders for unbuilt | ✅     | 2026-10-14 / 10-29                                                                                                        |
| User menu, profile, preferences, themes, proxy picker    | 🟡     | Manage profile matches 621 layout (columns, role lists, Email) 2026-11-03; Preference/Manage tabs not compared            |
| Header Help and notifications controls                   | 🟢     | Help → Tutorials as legacy globalHeadersData; bell list, Escape; e2e 2026-11-03                                           |
| Guided Learning (driver.js)                              | 🟢     | Completion defect fixed 2026-10-30; guide text to the RB later                                                            |
| Chatbot                                                  | 🟢     | Matches legacy markup (header, log, quick replies, user/time); time `h:mm A` via `clockDisplay` 2026-11-03; not sent live |
| Docker image                                             | ✅     | Running on Azure `gn-migration-ca` 2026-11-04; one `.env.<env>`, secrets not baked; `scripts/docker.sh help`              |
| IDCS sign-out (`id_token_hint`)                          | 🟢     | Fixed 2026-11-04 after IDCS 400 on Azure; awaiting the next image                                                         |
| ORDS client credentials (`ORDS_AUTH_MODE=oauth`)         | ✅     | DEV `dev_base` and `dev` tokens 2026-11-04; Azure sign-in uses it                                                         |
| Production deploy / hosting review (fonts, CDN)          | ⛔     | Owner                                                                                                                     |

## Shared record framework

| Item                                                           | Status | Evidence / note                                                                                                                |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `RecordFrame` (panel, tabs, Finalize, edit-mode hides panels)  | ✅     | Awards, EOI, Claims Funds, Claims Unit; tab bar is the shared `RecordTabs` (also Proposals, Contracts) 2026-11-03              |
| Comments (@mentions), Audit trail                              | ✅     | Live award 1183, EOI                                                                                                           |
| Audit: MIME description for `DOCUMENT_TYPE`/`FILE_TYPE` (5980) | ⬜     | Legacy uses it in Ethics/DD only; carry when those are built                                                                   |
| Attachments (folders, upload, preview, links, delete)          | ✅     | Live OIC 2026-10-23; detail pane pitch as 621, no Download button (legacy) 2026-11-03                                          |
| Approvals (route, stages, Generate, Submit, verdicts, graph)   | 🟡     | Generate live on EOI 3954; history comments trimmed to 35 chars + full-comment dialog (legacy) 2026-11-03; Submit not run (⛔) |
| History (Add Status, Abandon), Delegation                      | ✅     | Live award 1183, EOI 4034                                                                                                      |
| Dynamic forms (create, save, required, finalize)               | ✅     | Live EOI 3954; 9408 (async checkbox `required`) — n/a, check once                                                              |
| Dynamic forms: stakeholder id wait (9331)                      | —      | Legacy binding race; the rebuild passes the id with the form                                                                   |
| Object attributes (LOV value not among options shows blank)    | ✅     | Live 2026-11-03: award 1190 Attribute 3 saved and persisted (backend persists now)                                             |
| Linked objects ("Link to")                                     | ✅     | Live 2026-11-03: award 1188 Linked Objects opened (proposal, award, contract); backend 70 s                                    |
| FX rates                                                       | 🟢     | Built, not mounted (Proposals)                                                                                                 |
| One dialog frame (`ActionDialog`: `help`, `dismissible`)       | 🟢     | Every modal on it except the nav drawer and chatbot window, 2026-11-03                                                         |
| Creator card (`CreatorLink` / `personCard`)                    | ✅     | Awards, EOI                                                                                                                    |
| Report files (`fileRoute`, `download`, `reportPayload`)        | ✅     | Proposals Print, Claims Export                                                                                                 |

## Home

| Item                                                        | Status | Evidence / note                                                                                                              |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Organization heading, announcements carousel                | ✅     | `docs/home-coverage.md`                                                                                                      |
| KPI strip, sparklines                                       | ✅     | Live                                                                                                                         |
| Nine Need Attention queues (paging, overdue, links)         | ✅     | `appr_deadline_date` not yet seen in a live payload                                                                          |
| Chart legend: HTML, one width, scrolls, toggles series      | ✅     | Live Home and Analytics 2026-11-03                                                                                           |
| Insights: 15 panels, filters, drill                         | ✅     | Drill live 2026-11-03: Proposals by Year 2026 Closed Funded → 151 rows, same as 621. FOS HTTP 555 on DEV (621 shows no data) |
| Dashboard tabs (five configured), dimension preference save | 🟢     | No live preference write                                                                                                     |
| Calendar view                                               | ✅     | Colours, heights within 1px of 621 (FullCalendar, legacy fp-cal palette) 2026-11-03                                          |

## Opportunities and EOI

| Item                                                             | Status | Evidence / note                                                                                                          |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Finder (filters, Advanced filter, cards, dialogs)                | ✅     | Live 2026-10-22; Advanced filter not in the URL, as legacy manageFilterURL (six keys)                                    |
| Share, Convert, Comments, deadline-warning dialogs               | 🟢     | Share/Convert live; Comments and deadline warning e2e 2026-11-03 (fixtures)                                              |
| Bookmarked / Shared tabs, narrow screens                         | 🟢     | e2e 2026-11-03 (Bookmarked, Shared, 390px no sideways scroll); not live                                                  |
| Analytics dashboard                                              | ✅     | On the shared chart: panels 818×619 as 621, rotated labels, inside %; DEV's unlabelled row drawn. Legend title not shown |
| EOI list                                                         | ✅     | Live                                                                                                                     |
| EOI record: Application, forms, attachments, history, delegation | ✅     | Live 3954                                                                                                                |
| EOI record: workflow Submit                                      | ⛔     | Owner approval to notify DEV approvers                                                                                   |

## Proposals (Easwar's module)

| Item                                                          | Status | Evidence / note                                                   |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Listing (cards, statuses, filters, scroll paging)             | ✅     | Fixture browser journey; native date inputs remain (self-check)   |
| Listing: Create / Copy (8563 cascade) / Recycle / Share       | 🟡     | Easwar 2026-11-02, fixtures; Advanced Query too; no live write    |
| Record shell on `RecordFrame`                                 | 🟡     | Shared tab host used; full module parity still pending            |
| Summary view and edit (sponsors, PI, partners, deadlines)     | 🟡     | Easwar 2026-10-27                                                 |
| Budget (versions, staff), FEC summary, quick cost             | 🟡     | Staff/nonstaff fixture save journey; 9305 expansion not carried   |
| Pricing (9382 combined per partner, 9410 fixed layout)        | 🟡     | 9305 `PROPOSAL_PRICING_EXPAND_LEVEL`, 9382 follow-ups not carried |
| Allocation for credit, contracts (where-clause fixed), linked | 🟡     |                                                                   |
| Print (`report_code` = page name, fixed)                      | ✅     | 2026-10-30                                                        |
| Approvals, attachments, history, delegation (shared hosts)    | 🟡     | Host adapters still flat in the server folder                     |
| Ethics / Due Diligence tabs                                   | 🟡     | Modules started 2026-11-03 (listing, draft, overview); see below  |

## Awards

| Item                                                           | Status | Evidence / note                                                       |
| -------------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| Listing (status tabs, drawer filters, cards/list)              | ✅     | Live 2026-10-26                                                       |
| Listing actions: Link, Generate Award                          | ✅     | Live 2026-10-30                                                       |
| Header (panel, dynamic form, Save Header)                      | ✅     | Live 1176; Save Header 2026-11-02                                     |
| Header: Created by = `created_by` (9412)                       | ✅     | Live 2026-11-03: award 1190 (PI Titiksh) shows Brock Philips, as 621  |
| Header dates and back-to-proposal after refresh (9326)         | ✅     | Rebuild reads periods and `proposal_id` on every load                 |
| Budget periods, Projects (add/edit), Project Costs             | ✅     | Live 1176                                                             |
| Project Costs tree start depth (9305)                          | ⬜     | Next up 3                                                             |
| Credit allocation, Installments, Milestones, Report            | ✅     | Live 1176                                                             |
| Dynamic forms 1–5, Attachments, Approvals, History, Delegation | ✅     | Shared hosts                                                          |
| Due Diligence tab (list), Create Governance                    | 🟡     | Opens the DD module; its listing and overview are built, fixture only |
| Send to ERP                                                    | ⛔     | Skipped by the owner                                                  |

## Ethics and Due Diligence (Easwar's modules)

| Item                                                  | Status | Evidence / note                                                            |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Listing (access views, filters, paging, recycle)      | 🟢     | `118d553`, fixtures; no live read                                          |
| New (general overview setup draft)                    | 🟡     | No dynamic form yet; no live write                                         |
| Record overview                                       | 🟡     | On `RecordFrame`, RB labels 2026-11-04; other tabs not built               |
| §4 structure, `TabBar`, own DD CSS                    | 🟢     | 2026-11-04 (owner), fixtures                                               |
| Responses, reviewers, approvals, attachments, history | 🟡     | History and Ethics attachments built; remaining tabs pending, fixture only |

## Contracts (Easwar's module)

| Item                                                    | Status | Evidence / note                             |
| ------------------------------------------------------- | ------ | ------------------------------------------- |
| Listing                                                 | 🟡     | Date filters still native inputs (guide §8) |
| Record: summary, workflow, signers, history, delegation | 🟡     | Shell not on `RecordFrame` (guide §10)      |
| Summary: editable Contract Detail form                  | ⬜     | Guide §8                                    |
| New Contract: Create on the shared `DynamicForm`        | ⬜     | Guide §8                                    |
| Signers: request by email posts status `SUB` (8798)     | ⬜     | Not built                                   |

## Claims

| Item                                                         | Status | Evidence / note                                                                                                                                |
| ------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit Inquiry listing (filters, create/update, Clone, Export) | ✅     | Live 2026-10-30; 'No Funds Assigned!' on a fundless app (1066) live 2026-11-03                                                                 |
| Funds Inquiry listing                                        | ✅     | Live 2026-10-30                                                                                                                                |
| Funds record: Summary, Budget, Claims, Attachments, Export   | ✅     | Live fund 641/521                                                                                                                              |
| Funds record: approvals, awards, dynamic forms flows         | ⬜     | Legacy flows exist; check legacy getTabs                                                                                                       |
| Unit record: shell and panel                                 | ✅     | Live app 1130 vs VBCS 621                                                                                                                      |
| Unit Summary: Fund Summary, Preparer/CFO, Signed Off, Terms  | ✅     | Live app 1130 (reads)                                                                                                                          |
| Unit Summary: Edit / Save (`putAppSummary`)                  | ✅     | Live write 2026-11-03 on app 1065 (persisted; same in 621)                                                                                     |
| Unit Summary: allocations, stakeholders, meetings, documents | ✅     | Live 2026-11-03 on 1065: allocations, stakeholders, meetings + file, documents + file, delete                                                  |
| Unit Summary: stakeholder exports, Assurance, audit buttons  | ✅     | Live 2026-11-03: export, Assurance submit (req 785), allocations audit                                                                         |
| Unit Summary: grant category columns per fund line (9342 v2) | —      | Not on legacy `development` yet (uncommitted on `Claim_DEV_Beta`)                                                                              |
| Unit record: Goals, Attachments, Activities, Claims          | 🟡     | Goals ✅ live add/edit/delete; Attachments ✅ live; Activities 🟡 slices 1 and 2a live-read on DEV (384, 1065); Delete not run live; Claims ⬜ |
| Unit record: approvals                                       | ⬜     |                                                                                                                                                |

## Not rebuilt (navigation placeholders)

Ethics, Due Diligence, Reports (external), Announcements, Administration, Customer Support, API docs, Tutorials,
Notifications: ⬜.

## Legacy tickets to carry

New tickets from the KB catch-ups, and what each means for the rebuild.

| Ticket | Legacy change                                                  | Rebuild                                                        |
| ------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 9412   | Award "Created by" is `created_by`, not the PI                 | 🟢 2026-11-03 (`awards/record.ts`, `shell.ts`, `creator.ts`)   |
| 9326   | Award header dates and parent proposal after a refresh         | — already so                                                   |
| 9305   | Costing trees open to a configured depth (3 global variables)  | ⬜ Awards (next up 3); Proposals Budget/Pricing (Easwar)       |
| 9382   | Combined Pricing per research partner, read-only with partners | ⬜ Proposals (Easwar)                                          |
| 9410   | Pricing table fixed layout                                     | ⬜ Proposals (Easwar)                                          |
| 8563   | Copy Proposal dialog parent/child cascade                      | ⬜ with Copy Proposal                                          |
| 9554   | Insights: three grant-category charts take Year/Quarter/Month  | ⬜ check `widgets.ts` sends the filter for all three           |
| 9555   | "Proposals by Year" → "Submitted vs Awarded…", legend by code  | ⬜ title is RB (`proposals-by-year`); legend SUB/AWARD to do   |
| 9319   | Read-only form values truncate instead of overflowing          | ⬜ `ReadonlyField` wraps (`overflow-wrap`); compare on 621     |
| 8483   | Popups read RB messages; attachment upload-success key         | ⬜ check shared attachments' toasts use the RB message         |
| 9410+  | `COMBINED_COLLAB_SPLIT` global: Combined view partner split    | ⬜ Proposals Budget/Pricing (Easwar)                           |
| Claims | Claims redesign merged (MR 15893): fund bar, 8-col Summary,    | ⬜ **compare before more Claims work**: KB GrantsNow-Claims §  |
|        | unit-card links, activity/claim drawer; 9342 additional        | "Claims redesign brought into VBCS"                            |
| 8798   | Contract signer request posts `SUB`                            | ⬜ with Signers request                                        |
| 5980   | Audit drawer shows MIME descriptions                           | ⬜ with Ethics/DD                                              |
| 9408   | Required checkbox raced the save validation                    | — React validates in the same render; recheck with a live form |
| 9331   | Dynamic form waits for the stakeholder id                      | —                                                              |
| 9328   | Ethics tab the user cannot read redirects within the app       | ⬜ with Ethics                                                 |
| 9342   | Grant category per fund line (v2)                              | — not on `development` yet; carry when it lands                |
| 9172   | `DEFAULT_DATE_FORMAT` lower case (JET minutes) — reverted      | — the rebuild formats with moment, which upper-cases it        |
