# Working in this repository as a coding agent (Codex, Claude Code, any other)

Every agent and every person works on the same app, so the same rules apply to all. The owner (Titiksh) sets
the framework and the rules. They live in this repository, so every machine has them:

- [AGENTS.md](../AGENTS.md)
- this guide
- [grantsnow-foundations.md](grantsnow-foundations.md)
- [api-layer.md](api-layer.md)
- the latest entries of [progress.md](progress.md)

Each developer's private KB (Obsidian) adds old-app findings. The KB never overrides what is written here.

## 1. Before any change, rebase or merge

Read these, in this order, every session:

1. `AGENTS.md`
2. this guide
3. `docs/grantsnow-foundations.md` (the rules)
4. `docs/api-layer.md`
5. the top three sections of `docs/progress.md`

Then confirm three things before you edit anything:

- **What exists already.** Search `src/components`, `src/features/record`, `src/server/record`, `src/lib` and
  `src/server/oracle/api` for the thing you are about to build. Use §3 below as the index.
- **What the legacy app does.** The VBCS source (`origin/development`, read-only) and the KB are the source of
  truth for behaviour. Do not invent behaviour, labels, fallbacks, checks or toasts.
- **Why the current code is the way it is.** `git log -p` on the file, plus the progress and foundations
  entries. A pattern you find strange is usually a recorded decision.

## 2. Rebases, merges and conflicts

- **Re-read the rules from the incoming tree, even mid-session.** A rebase, merge or pull can change `AGENTS.md`, this
  guide, the foundations, the API layer doc and `docs/changes/`. What you read at the start of the session is out of
  date.
  1. When the rebase or merge stops, and before you resolve any conflict, re-read `AGENTS.md`, this guide (§2–§5 and
     §8 onwards), `docs/grantsnow-foundations.md`, `docs/api-layer.md` and the top of `docs/progress.md`, as they are
     on the incoming side (`git show <incoming>:<file>` while the rebase is in progress).
  2. Read every `docs/changes/` record the incoming commits added, listed by
     `git diff --name-only --diff-filter=A $(git merge-base ORIG_HEAD <incoming>) <incoming> -- docs/changes`,
     plus every record that touches a file you change.
  3. Resolve conflicts against those rules, not the ones you remember. After the rebase, read them once more from
     the working tree, bring your own uncommitted work onto them, and run the §9 self-check before the checks below.
- **Never resolve a conflict by taking your side wholesale.**
  - Keep both behaviours where they are compatible.
  - Where they clash, the framework and rule side wins, unless you can name the defect it causes.
- **Never revert or re-implement owner framework code** (shared components, the API layer, record hosts, motion,
  ids, RB visibility, layout rules) to make your change easier. Bring your change onto it instead.
- **Overriding a framework decision needs a solid reason.** That means a reproduced defect or a legacy behaviour it
  breaks. Write the reason in `docs/progress.md` and leave the change for the owner to review. "Simpler for my
  feature" or "the old code did X" is not a reason.
- **After a rebase**, run all of these and report the results honestly:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test`
  - the isolated build (`GRANTSNOW_BUILD_CHECK=true DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build`)
  - `npm run test:e2e`
- **Do not commit, push or deploy** unless your owner asks. The repository owner reviews and commits.

## 3. Reuse before you build: the house components and layers

| Need                                                                                   | Use                                                                                                                                                        | Not                                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Any dropdown                                                                           | `Select` / `MultiSelect` (`components/ui`), `FormSelect` inside a plain form                                                                               | native `<select>`                                         |
| Date field                                                                             | `DateInput`                                                                                                                                                | `<input type="date">`                                     |
| Dialog                                                                                 | `ActionDialog`, `useConfirm` (`components/dialog`)                                                                                                         | `<dialog>` by hand, a fixed backdrop `div`                |
| Table (flat or tree), row actions                                                      | `DataTable` (`components/ui`): `columns`, `rows`, `rowKey`, `actions`, `childrenOf`                                                                        | a hand-written `<table>`, unpinned action cells           |
| Read-only value                                                                        | `ReadonlyField` (label and value)                                                                                                                          | a disabled or read-only control                           |
| Loading / error / empty                                                                | the skeleton of the content's shape (`ListingSkeleton`, `DetailSkeleton`, `FormSkeleton`, `TableSkeleton`, `ListSkeleton`), `State`, toasts via `useToast` | "Loading…" text, ad-hoc error markup                      |
| Status pill                                                                            | `StatusBadge` with a tone map                                                                                                                              | per-module chip CSS                                       |
| Created by                                                                             | `CreatorLink` / `CreatorDialog`, `personCard` (server)                                                                                                     | a module's own creator dialog                             |
| Timestamp in the viewer's zone                                                         | `LocalTime` (browser), `stampDisplay` / `dateTimeDisplay`                                                                                                  | formatting on the server, `Intl` with a fixed zone        |
| Collapsible section                                                                    | `Collapsible` (owns the chevron, its rotation and the heading row; `headClassName` for size, `actions` for heading buttons)                                | a hand-written `<details>`, its own chevron or marker CSS |
| Listing filters                                                                        | `FilterPanel`, `FilterSection`, `StatusList`, `statusChoices` (server)                                                                                     | hard-coded status lists                                   |
| Record page shell                                                                      | `RecordFrame`, record panels (comments, audit)                                                                                                             | a module's own header and panel wiring                    |
| Approvals                                                                              | an `ApprovalHost` + `workflowView` / `workflowRead` + `ApprovalWorkflow`                                                                                   | a module's own route, graph or approvers reads            |
| History, delegations, attachments, dynamic forms, linked objects, attributes, FX rates | the hosts in `src/server/record/*` and components in `src/features/record/*`                                                                               | a module copy                                             |
| Record rights                                                                          | `objectAccessOf`, `recordRoleRows`, `finalizedOf`, `pageAccess`                                                                                            | hand-written `page_name` filters                          |
| Oracle                                                                                 | named functions in `src/server/oracle/api/*` (`read` / `write`, allowlist in `operations.json`)                                                            | `oracle()`, a generic "read any op" passthrough           |
| Browser to API                                                                         | `@/lib/api` endpoints + `useApi` / `usePagedApi`                                                                                                           | `fetch('/api…')`, server actions, hand-built `/api` URLs  |
| Motion                                                                                 | the presets in `@/lib/motion`, `Pop`, the CSS tokens                                                                                                       | one-off keyframes                                         |
| Libraries                                                                              | lodash, moment, motion, downshift, the existing set in `package.json`                                                                                      | a new dependency (ask the owner first)                    |
| App-wide constants and shared pure helpers                                             | `constants` / `serverConstants`, `functions` / `serverFunctions` (by category)                                                                             | a local copy or a module's own helper                     |

When two modules need the same thing, it becomes one shared piece, and the modules differ only in data.

## 4. Project structure (decided; follow it exactly)

Copy the **Awards** module: it is the reference for every folder below. A module with two sub-applications (Claims:
Unit Inquiry and Funds Inquiry) repeats the same layout once per sub-application, in a folder named after it.

```text
src/app/(authenticated)/<module>/
  error.tsx
  (list)/page.tsx, loading.tsx                      the listing route: reads the shell, renders <ModuleList>
  (record)/[id]/layout.tsx, page.tsx, loading.tsx   the record route: access + context, renders the shared shell
  (record)/[id]/[tab]/page.tsx                      one tab: reads its data, renders <TabComponent>
src/app/api/<module>/
  route.ts                                          the listing page (GET)
  choices/route.ts                                  one dropdown list per `?list=`
  actions/[action]/route.ts                         listing dialogs (GET setups, POST writes)
  [id]/<tab or action>/route.ts                     a record's tab reads and writes
src/server/modules/<module>/
  listing.ts        listing view (gates, texts, statuses), filters to Oracle query, row mapping, choice lists
  actions.ts        the listing's dialogs and writes (create, clone, link, export)
  record.ts         record context: access, roles, RB bundle, tabs (the one place a record is authorised)
  record/shell.ts   the shell's display model (header fields, tabs, finalize), read by the record layout
  record/<tab>.ts   one file per tab: its reads, writes and display model
src/features/modules/<module>/
  listing/          the list component, its dialogs, schema.ts (filters), types.ts (display model)
  record/           record-shell.tsx (renders RecordFrame), one <tab>-tab.tsx per tab, its dialogs and CSS
  links.ts          the module's in-app hrefs
src/shared/<module>/                                pure helpers and types both sides use
src/lib/api/endpoints/<module>.ts                   the browser's endpoints for this module (one file)
src/server/oracle/api/<area>.ts                     one named function per backend operation
src/test-support/<module>*.ts                       labelled fixtures shaped like real payloads
tests/unit/<module>-*.test.ts, tests/integration/<module>-*.test.ts, tests/e2e/workspace.spec.ts
docs/changes/YYYY-MM-DD-<author>-<slug>.md          one record per change
```

- **A route folder holds only `page.tsx`, `layout.tsx`, `loading.tsx` and `error.tsx`.** Every component, hook and
  CSS module, client or server, lives under `src/features/modules/<module>/` and the route imports it. A page reads
  its data and renders one component; it does not hold the UI. API routes only parse the request and call one
  `src/server/modules` function (`route` / `fileRoute`).
- **No `components/` folder in a module** (Home, a dashboard of widgets rather than a listing and records, keeps
  `home/components/`; it is the only exception). UI goes in `listing/` or `record/` (or the sub-application's folder).
  Shared UI that two modules use goes in `src/components/` (house components) or `src/features/record/` (record
  features), never copied into a module.
- **Server code is never flat.** The listing, its actions, the record context and each tab are separate files as
  above. A tab's service lives in `record/<tab>.ts`, not beside the listing.
- **Names:** kebab-case files; a component file is named after its component (`unit-list.tsx` → `UnitList`); a tab
  is `<tab>-tab.tsx` in the browser and `record/<tab>.ts` on the server.

### The one request path (the framework)

Every feature, read or write, goes through the same layers, in this order. Skipping or duplicating a layer is the
mistake to avoid.

1. **Page or component** (`src/app` → `src/features`): a server page awaits only its shell and streams the rest; a
   client component calls `@/lib/api` endpoints through `useApi` / `usePagedApi` (reads) or the endpoint's write
   function inside `useInFlight` (writes, control disabled until it settles).
2. **Browser endpoint** (`src/lib/api/endpoints/<module>.ts`): `endpoint` / `pagedEndpoint` / `get` / `post` /
   `download`. Never `fetch('/api…')` elsewhere.
3. **API route** (`src/app/api/<module>/…`): `route` (JSON) or `fileRoute` (a file); `write: true` for writes
   (same-origin check and fresh reads).
4. **Server module** (`src/server/modules/<module>/…`): `authenticate()`, the drawer grant, RB gates and roles, input
   validation (zod, strict), the explicit write pick, the display-model mapping. Everything the browser could forge is
   checked here.
5. **Oracle API function** (`src/server/oracle/api/<area>.ts`): `read` / `write` / `writeFile`, one per operation,
   listed in `operations.json`. Identity, caching, paging and invalidation are the client's job.

### The record framework

Every record page (a proposal, an award, an EOI, a contract, a claims application) uses the shared record pieces.
A module never builds its own:

- **Shell:** `RecordFrame` (`src/features/record/shell`): header panel, tabs from the record context, Finalize,
  Comments / Audit Trail, the unsaved-changes guard. The module passes data, not markup.
- **Shared tabs:** attachments, approvals (`ApprovalHost` + `ApprovalWorkflow`), history, delegations, comments,
  audit, dynamic forms, attributes, linked objects, FX rates: the hosts in `src/server/record/*` and the components
  in `src/features/record/*`, mounted with the module's object type and role keys.
- **Access:** `record.ts` computes the record's roles and tabs once (`objectAccessOf`, `pageAccess`,
  `finalizedOf`); every tab service and route checks against it.

## 5. How to build (the short form of the rules)

- **Labels and visibility come from the RB.**
  - Fail closed: show something only when `is_visible === 'Y'`.
  - Use literal fallbacks, and the configured lookups for status names and tabs.
  - Never hard-code a list the backend configures.
- **Every write payload is an explicit pick.** Identity, scope and the actor come from the server session. A write
  control stays disabled until its request settles.
- **Every element gets a stable kebab-case `id`** (`<area>-<element>`, plus the record key for repeats): every
  section, table, dialog, button, link and control, in new code too. Never rename an id a test or another page uses.
- **Tables are `DataTable` from the first commit.** A hand-written `<table>` is never left as a later migration;
  trees use `childrenOf`, totals a column `footer`, row buttons `actions`. If `DataTable` cannot show something,
  extend it once (backwards compatible) instead of writing a table.
- **Numbers, money, percentages and dates are formatted only by `functions.format`** (`moneyDisplay`,
  `percentDisplay`, `dateDisplay`, …). No `Intl.*` or `toLocale*` in a module; add a helper to `functions.format`
  when one is missing.
- **Expandable panels are `Collapsible`** (it owns the chevron and its turn); read-only values `ReadonlyField`;
  status chips `StatusBadge`.
- **The shared layers name no module.** `connection.ts`, `client.ts`, `route.ts` and the shared components never
  test an operation name or a module; fixture behaviour (which simulated write answers a body, a stub file) lives in
  `src/test-support/`.
- **One function per backend operation, app-wide.** Before adding one to `src/server/oracle/api/*`, search for the
  operation name: report files are `reports.generate` (a write, behind the writes gate, as every POST), served with
  `fileRoute` and fetched with `download` (`@/lib/api/http`); report bodies come from
  `serverFunctions.reports.reportPayload`.
- **Layout follows the viewport** (owner, 2026-10-26):
  - Widths and heights of layout containers are `vw` / `vh` wherever possible, and `%` / `fr` otherwise. Translate
    a measured JET grid fraction (`oj-sm-10` → `83.333%`).
  - Use no fixed px caps on layout (`min(84%, 1000px)` was wrong), and size grid tracks to content (`auto`) where
    legacy does.
  - px are for component details only: borders, icons, radii, control heights, small gaps.
- Match the live DEV app **by measurement**: bounding boxes and computed styles at the same viewport.
- **Timestamps:**
  - The server passes the raw ISO value.
  - The browser formats it in the viewer's zone (`LocalTime`).
  - Never use a fixed zone such as `Asia/Kolkata`.
- **Performance:** independent awaits run in parallel. Cache only what the VBCS app caches. Heavy reads (an
  approval graph) load when they are opened.
  - A page awaits only what its shell draws (identity, access, labels, format, record context).
  - Lists, sections and panels stream in as their data arrives, so one slow read never holds the page. A client
    list gets `initial: functions.errors.settle(read)` in `usePagedApi`; a server section goes behind its own `<Suspense>`.
  - Ten things never wait for one: never bundle independent pieces into one reply. Each dropdown's options,
    panel or table is its own read (`?list=` / `?group=` / `?view=`), and degrades alone (`choiceList`).
  - Lookups and org units are held for the session (`ttl.session`), as the live app holds them.
  - App-wide constants come from `constants` / `serverConstants`, and shared pure helpers from `functions` /
    `serverFunctions`; never a local copy.
  - Details are in the foundations doc, under Performance.
- **Minimal diffs at the true cause.** Comments are one line of why. Delete dead code; do not leave a parallel
  copy beside the shared one.

## 6. Think before you change

Before a large change, write down three things, in progress.md or in your reply:

- what problem it solves;
- which legacy behaviour or rule requires it;
- which shared pieces it uses.

A rewrite that only reorganises, renames or restyles, with no defect or requirement behind it, does not go in. If
the shared framework lacks something you need, extend the shared piece once and keep it backwards compatible,
rather than forking it in a module.

## 7. Record every change

Every change set gets a file in `docs/changes/` (template and rules in `docs/changes/README.md`): why, what
changed, which shared pieces it uses, what it replaces or overrides and why that is better, which rules it touches,
and the checks as they came out. Before editing a file, rebasing or resolving a conflict, read the records that
touch the same files or module. A change that would undo what a record explains is described under **Replaces**
and left for the owner to decide; it is not made silently.

## 8. What was overridden on 2026-10-26, and why

The Contracts merge (`d77fd6e`) was brought onto the framework. These changes were replaced. Do not reintroduce
them:

- **A generic `contractRead(op, …)` passthrough to any allowlisted operation.** Replaced by named functions
  (`contracts.*`, `roles.record`, `lookups.*`, `people.all`, `dynamicForm.forms`). Why: the API layer rule.
- **A trimmed `operations.json` that dropped operations Contracts still called.** Restored. The allowlist follows
  the operations the server names.
- **A separate read-only Contracts workflow** (its own stages, graph, approvers dialog via `?stage=`, history).
  Replaced by `contractApprovalHost` and the shared `ApprovalWorkflow`, with the legacy fragment's role keys.
  Why: legacy mounts the same shared fragment for every module.
- **`width: min(84%, 1000px)` on the shared workflow.** Replaced by `83.333%` (legacy `oj-sm-10`), with no gap
  between Route and History. Why: measured on DEV, and the layout rule.
- **Server-side `Asia/Kolkata` time formatting** (history, approvals). Replaced by the raw value plus `LocalTime`.
- **Eight hard-coded header labels; hard-coded status tabs and status names.** Replaced by the RB-gated field list
  and the `CONTRACT_STATUS` lookup.
- **Workflow and Signers hidden in Draft and Rework unconditionally.** Replaced by legacy getTabs: they open when
  every finalizable page is finalized.
- **Server actions for New Contract choices.** Replaced by API routes plus `useApi`.
- **10 native `<select>`s, a hand-rolled `<dialog>`, a hand-rolled approvers dialog.** Replaced by `Select` /
  `FormSelect`, `ActionDialog`, and the shared `ApproversDialog`.
- **LIKE filters without escaping.** Replaced by `containsClause`.
- **Dynamic-form visibility `!== 'N'`.** Replaced by fail-closed `Y` / `C`.
- **Duplicate `contractHistory`, `contractComments`, `contractAudits` and `contractDelegations`.** Removed: the
  shared hosts do this.
- **`src/server/contracts` and `src/features/contracts`.** Moved to `src/server/modules/contracts` and
  `src/features/modules/contracts`.

Kept, because they match legacy:

- the read-only file field's disabled drop box;
- the plain-text delegations empty state;
- the delegations alignment;
- Contracts' `NEW VERSION CREATED` audit filter.

Still open in Contracts (Easwar's area), to be built on the shared pieces:

- the Summary tab's editable Contract Detail form;
- New Contract's Create, which should mount the shared `DynamicForm`;
- the listing's date filters (to `DateInput`).

## 9. Before you finish: the self-check

Run these on the files you changed and fix what they find, or write in your change record why one stays:

- `grep -rn "<table\|<select\|<dialog\|<details\|type=\"date\"" src/app src/features` (only shared components
  may hold these);
- `grep -rln "Intl\.\|toLocale" src/app src/features src/server/modules` (formatting goes through `functions.format`);
- route folders hold only pages and layouts:
  `find src/app -name "*.tsx" | grep -vE "/(page|layout|loading|error|not-found)\.tsx$"` prints nothing;
- every `<button`, `<a`, `<input`, `<DataTable` and `<ActionDialog` you added has an `id`;
- the module follows §4: `find src/features/modules -type d -name components` prints only `home/components`; the module's server
  folder has `listing.ts`, `actions.ts`, `record.ts` and `record/` (no tab service beside them); its browser folder
  has `listing/` and `record/`;
- every record page renders through `RecordFrame` and the shared hosts. Both commands print nothing:
  `for f in $(find "src/app/(authenticated)" -path "*(record)*" -name layout.tsx); do grep -q record-shell "$f" || echo "$f"; done`
  and `grep -L RecordFrame $(find src/features/modules -name record-shell.tsx)`; no module has its own tabs bar,
  comments or audit drawer, approvals graph or attachments panel;
- each new feature goes page → `@/lib/api` endpoint → API route (`route` / `fileRoute`) → `src/server/modules` →
  `src/server/oracle/api`, with no layer skipped or duplicated;
- `grep -nE '"(get|post|put|delete)[A-Z][A-Za-z_]+"' src/server/oracle/connection.ts src/server/oracle/client.ts`
  shows no operation name except the session bootstrap guard (`getSessionLogin`);
- then typecheck, lint, tests, the isolated build and `npm run test:e2e` (§2).

## 10. What was corrected on 2026-10-30 (Proposals merge `aec5020`), and why

Brought onto the framework by the owner; do not reintroduce:

- **About 5,900 lines of Proposal record UI inside the route folders.** Moved to
  `src/features/modules/proposals/record/`, routes in `(list)` / `(record)` groups. Why: §4.
- **13 hand-written `<table>`s.** Replaced by `DataTable`. Why: §3, and "migrate later" never comes.
- **Buttons without ids** (about half the new ones). Ids added. Why: the ids rule; tests and guides find elements
  by id.
- **Three local `Intl.NumberFormat` formatters.** Replaced by `functions.format`. Why: one formatting rule
  (decimals and currency from the configured format).
- **Three Proposal operation names inside `oracleWrite`'s fixture branch.** Moved to `mockOracleWrite` in
  `src/test-support/transport.ts`. Why: the shared connection names no module.
- **Two report-file paths built in parallel** (Proposals' `oracleFileWrite` / `writeFile` and Claims'
  `oracleFile` read). Proposals' kept, as `generateReport` is a POST and so a write; the Claims read removed. On top,
  one route helper (`fileRoute`), one browser fetch (`download`) and one payload builder (`reportPayload`), used by
  Print and Claims Export.

Still to bring onto §4 (owner, 2026-10-30; whoever next works in the module does it, recorded in `docs/changes/`):

- **Proposals record shell:** its own header and tabs (`record/record-header.tsx`, `record/proposal-tabs.tsx`) →
  `RecordFrame`, with the record context in `src/server/modules/proposals/record.ts`.
- **Proposals server layout:** 19 files flat in `src/server/modules/proposals/` → `listing.ts` (the listing,
  `service.ts`, `where-clause.ts`, `lookups.ts`), `actions.ts`, `record.ts` and `record/<tab>.ts` (budget, pricing,
  quick-cost, viability, edit, finalize, print, ai, contracts, credit-allocation, linked-applications; history,
  delegation, approval and attachments are host adapters and go in `record/` too).
- **Proposals browser layout:** `components/` (`listing.tsx`, `record-card.tsx`) → `listing/`; `lookups.ts` and
  `record.ts` at the module root → `listing/` or `record/` by use (types both sides use → `src/shared/proposals/`).
- **Contracts record shell:** `record/contract-tabs.tsx` and its own header → `RecordFrame`; server
  `service.ts` / `create.ts` / `workflow.ts` / `documents.ts` → `listing.ts`, `actions.ts`, `record.ts`, `record/<tab>.ts`.
- **Opportunities:** `components/` → `finder/` / `listing/` by use.

Kept, because they were right: the change records, the logged guided-tour fix with its reproduced defect, the named
API functions, `functions` / `serverFunctions`, session-held lookups, `generateReport` as a write.
