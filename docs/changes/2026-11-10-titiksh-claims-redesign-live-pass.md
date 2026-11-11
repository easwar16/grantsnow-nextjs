# Claims redesign (MR 15893 and the D - Claims Live App prototype), Guided Learning once, live checks

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-rebase-proposal-ethics-sync.md`)
- **Why:** owner, 2026-11-10: "check & implement whatever you can from [D - Claims Live App] for claims design; the
  claims UX need to get better"; finish what waited; live-check what is left; Guided Learning auto-runs on every
  login; build a shared component where one is needed.

## What changed

- **Shared pieces (built because two or more places need them):**
  - `StatusBadge` `dot` and the `rework` tone (legacy `claim-status`, MR 15893), with `claimStatusTone` in
    `src/shared/claims/status.ts` (legacy `app-flow.js` `claimStatusTone`, same rules).
  - `Figures` (`components/ui`): legacy `claims-fund-figures`; the Activities bar now, the Claims bar and Fund
    Inquiry totals next.
  - `ActionDialog` `side`: legacy `oj-drawer-popup#recordDrawer`, full height at the end edge, 62.5vw (legacy
    `min(1200px, 92vw)` at 1920), the full width below 768px. Still the one dialog frame.
  - `SectionNav` (`components/ui`): jump links over one scrolling page of sections (the prototype's record panels).
  - `DeniedRedirect` moved from `features/modules/opportunities/eoi` to `features/record/shell` (Awards, Claims and
    EOI routes imported another module's file).
- **Unit Inquiry cards (MR 15893):** the two Collapsibles are replaced by the card body: each fund with its status dot
  and, with `claims-unit-activities` read, an Activities link to `…/activities?fund=<app_fund_id>`; the claim counts
  as three coloured numbers. The Claims link waits for the Claims tab (only implemented routes are linked). DEV's user
  has no app-level `claims-unit-activities` role, so neither 621 nor the rebuild shows the link: same.
- **Summary (MR 15893):** the fund table goes from 12 to 7 columns as legacy: Grant/CFDA, Status (dot), Total Budget
  with Original / 20th day / Other under it (row and footer), Unapplied Balance, Pending Allocations, **Key Dates**
  (`table-headers.summary-key-dates`, fallback "Key Dates", as legacy `||`), Allocations. Terms and Conditions are
  collapsed (`Collapsible defaultOpen={false}`).
- **Activities (MR 15893):** the fund bar: Fund Type and Period beside the category counts, a rule, then `Figures`:
  Funds Status (dot), the four amounts (a negative Unapplied Balance red), Claim / Amendment Date when the fund has
  them, and the grant category, grant, payment and holding accounts when their RB label is visible. The tab opens on
  `?fund=` (server-checked). The Activity Details sub-tab is gone: the activity opens in the side panel over the
  list, which keeps its place (legacy record drawer). Status dots on the list, the panel, Goals and allocations.
- **Activity panel (prototype, beyond legacy):** one page with jump links instead of nested sub-tabs (General,
  Position Details, Suggested Claimable Amount, Amendment History, Claim Details); each section reads itself, in
  parallel, with its own skeleton.
- **Guided Learning:** the page tour is recorded as done when it starts, not only when it closes cleanly; a tour left
  by navigating, reloading or signing out returned at every login.
- **Dashboard Dimension save:** the write now invalidates `getSharedGetDynamicCharts` (the read is cached under
  `ttl.figures`, so a reload showed the old size) and posts legacy's exact body (spans as text).
- **§4 layout (my own debt, §9):** `claims/units/*` and `claims/funds/*` listing files moved into `listing/`;
  `api/claims/units/export` and `api/claims/funds/summary` moved into their `actions/[action]` dispatchers (export
  still answers a file), with the export body parsed in `exportRequest`, not the route.

## Live DEV evidence (2026-11-10, rebuild on localhost against DEV, VBCS 621 side by side)

- Unit Inquiry cards equal 621 (dots, counts, heading; no Activities links for this user in either).
- Summary (app 1065) and Activities (app 384: fund bar, side panel, one-page sections, jump links) read live.
- Dimension save: the POST returns 200 in both apps, but neither 621 nor the rebuild shows the new size after a
  reload: **the backend does not persist or return chart dimensions** (backend defect, same in legacy).
- Opportunities deadline warning: shown on Convert for opportunity 6932791 (closes 12-Nov-2026; DEV window 30 days),
  cancelled, nothing created.
- Approval Submit: not run. EOI 3954's approvals page is not readable for this user (the workflow read answers 403,
  so the tab is rightly hidden); award 1190 opens Workflow only once all its pages are finalized. Needs a record the
  user can route.
- Claims Activities Delete: not run; app 1065 has no activities, and deleting another user's test activity is not
  ours to do. To run once Add Activity is built.

## Shared pieces used or extended

`StatusBadge`, `Figures`, `ActionDialog`, `SectionNav`, `DataTable`, `Collapsible`, `InsideField`, `Select`,
`DeniedRedirect`, the actions dispatchers, the Oracle API `invalidates`.

## Replaces / overrides

- The listing's Collapsible fund/claim panels (2026-10-30) → the MR 15893 card body.
- The 12-column fund table → legacy's current 7.
- The Activity Details sub-tab → the side panel; its six sub-tabs → one page (prototype; legacy still has tabs —
  owner-requested UX).
- Guided Learning's "done on close" (2026-10-30 completion fix) → done on start.

## Rules touched

None changed. Hide-not-disable and RB fail-closed kept (the grant fields show only on a visible RB row).

## Checks

Typecheck clean; lint 0 errors (the existing TanStack warning); 101 files / 941 tests; isolated build passed (after
the route moves); full e2e 47 passed, 2 skipped, 1 failed: `zz-proposal-create` "creates a Grant App", the
timing-dependent failure recorded in `2026-11-10-titiksh-rebase-proposal-ethics-sync.md` (Easwar's create form
returns silently while its dynamic form is not ready; it passed in the previous full run). Claims Funds Inquiry
failed in two full runs from a race in the test (the tab clicked before its link took the new filter); the test now
waits for the link, and it passes. Node 22 on the host (the repo asks 24).

## Open

- Prototype items not built: Activities › Approvals sub-tab and Fund Surveys (slice 4 / need the approvals data),
  the Claims tab and claim/adjustment panels (Claims tab not built yet; will use `Figures`, `side`, `SectionNav`),
  fund-wide adjustments list, approvals inbox, `remaining_to_claim` (need backend services), Fund Inquiry redesign.
- Summary's four optional grant columns (legacy `grantColumn`, RB-gated) are not shown.
- Approval Submit needs a routable record; Activities Delete needs Add Activity.
- `home/service.ts` `Intl.DateTimeFormat` (today in a zone, not display; `90e46d0`) flagged by §9, left.
