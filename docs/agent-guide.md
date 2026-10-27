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

| Need                                                                                   | Use                                                                                             | Not                                                      |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Any dropdown                                                                           | `Select` / `MultiSelect` (`components/ui`), `FormSelect` inside a plain form                    | native `<select>`                                        |
| Date field                                                                             | `DateInput`                                                                                     | `<input type="date">`                                    |
| Dialog                                                                                 | `ActionDialog`, `useConfirm` (`components/dialog`)                                              | `<dialog>` by hand, a fixed backdrop `div`               |
| Loading / error / empty                                                                | `Skeleton` / `RecordSkeleton`, `State`, toasts via `useToast`                                   | "Loading…" text, ad-hoc error markup                     |
| Status pill                                                                            | `StatusBadge` with a tone map                                                                   | per-module chip CSS                                      |
| Created by                                                                             | `CreatorLink` / `CreatorDialog`, `personCard` (server)                                          | a module's own creator dialog                            |
| Timestamp in the viewer's zone                                                         | `LocalTime` (browser), `stampDisplay` / `dateTimeDisplay`                                       | formatting on the server, `Intl` with a fixed zone       |
| Collapsible section                                                                    | `Collapsible`, `.gn-collapsible`                                                                | custom open/close state and CSS                          |
| Listing filters                                                                        | `FilterPanel`, `FilterSection`, `StatusList`, `statusChoices` (server)                          | hard-coded status lists                                  |
| Record page shell                                                                      | `RecordFrame`, record panels (comments, audit)                                                  | a module's own header and panel wiring                   |
| Approvals                                                                              | an `ApprovalHost` + `workflowView` / `workflowRead` + `ApprovalWorkflow`                        | a module's own route, graph or approvers reads           |
| History, delegations, attachments, dynamic forms, linked objects, attributes, FX rates | the hosts in `src/server/record/*` and components in `src/features/record/*`                    | a module copy                                            |
| Record rights                                                                          | `objectAccessOf`, `recordRoleRows`, `finalizedOf`, `pageAccess`                                 | hand-written `page_name` filters                         |
| Oracle                                                                                 | named functions in `src/server/oracle/api/*` (`read` / `write`, allowlist in `operations.json`) | `oracle()`, a generic "read any op" passthrough          |
| Browser to API                                                                         | `@/lib/api` endpoints + `useApi` / `usePagedApi`                                                | `fetch('/api…')`, server actions, hand-built `/api` URLs |
| Motion                                                                                 | the presets in `@/lib/motion`, `Pop`, the CSS tokens                                            | one-off keyframes                                        |
| Libraries                                                                              | lodash, moment, motion, downshift, the existing set in `package.json`                           | a new dependency (ask the owner first)                   |

When two modules need the same thing, it becomes one shared piece, and the modules differ only in data.

## 4. Project structure

- **Routes** go in `src/app/(authenticated)/<module>/`. Use the `(list)` and `(record)` route groups, so that each
  has its own `loading.tsx`. API routes go in `src/app/api/<module>/…`. Routes stay thin and call a server
  function.
- **Server code for a module** goes in `src/server/modules/<module>/`. It holds the module's record context, its
  hosts for the shared fragments, and its services. Shared record features live in `src/server/record/`.
- **Browser code for a module** goes in `src/features/modules/<module>/`. Shared record UI lives in
  `src/features/record/`.
- **Types and pure helpers** that both sides use go in `src/shared/<module>/`.
- Oracle access happens only through `src/server/oracle/api/<area>.ts`.
- **Test fixtures** live only in `src/test-support/`. They are labelled, development-only, and shaped like real
  payloads.

## 5. How to build (the short form of the rules)

- **Labels and visibility come from the RB.**
  - Fail closed: show something only when `is_visible === 'Y'`.
  - Use literal fallbacks, and the configured lookups for status names and tabs.
  - Never hard-code a list the backend configures.
- **Every write payload is an explicit pick.** Identity, scope and the actor come from the server session. A write
  control stays disabled until its request settles.
- **Every element gets a stable kebab-case `id`** (`<area>-<element>`, plus the record key for repeats).
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
