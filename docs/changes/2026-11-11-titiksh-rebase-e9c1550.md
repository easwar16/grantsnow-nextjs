# Rebase onto e9c1550 and bring it onto the framework

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on e9c1550 (Easwar: Proposal pricing, in-kind, research partner, credit; Ethics and
  Due Diligence finalize, print, auto-submit, versions, references, approval, parent Create/Link)
- **Why:** AGENTS.md 2/3/6 and guide §2: incoming work is brought onto the framework, keeping both sides where they fit.
- **What changed:**
  - Conflicts resolved keeping both: Easwar's features on top of my uncommitted 2026-11-11 work (one function per
    operation, `applications.*`, `locks.*`, Ethics/DD listing layout, finalize lag fix).
  - Flat server files moved to `record/` (Ethics 7, DD 6, Proposals 2); staff-entry edits ported to `record/staff-entry.ts`.
  - Duplicate Oracle functions folded into the shared ones (list in guide §13).
  - Ethics/DD panel and attachment hosts moved into each module's `record.ts` (with Easwar's participant selection).
  - Shared `ParentDueDiligence`, `RecordPrint`, `ReferenceLink`; endpoints for Ethics/DD finalize, auto-submit, print.
  - Responses tabs on `Select`, `useConfirm`, `useLeaveGuard` and RB labels; Pricing ids, `numberDisplay(…, fixed)`,
    Reset/Global hidden without rights; DD New parent check in `dueDiligenceCreateParent`; ids added.
  - Agent guide §13 (Codex instructions for what e9c1550 missed).
- **Shared pieces used or extended:** `functions.format.numberDisplay` (`fixed`, backwards compatible), `ActionMenu`,
  `useLeaveGuard`, `useConfirm`, `useActionFailure`, `InsideField`, `applications.*`, `locks.*`, `dynamicForm.forms`.
- **Replaces / overrides:**
  - My award Due Diligence View/Create/Link (`due-diligence-link-dialog.tsx`, `api/awards/[id]/due-diligence`, its
    endpoints and integration tests) → Easwar's parent Create/Link on the DD module's `link` action, now as the shared
    `ParentDueDiligence`. His version serves Proposals too; mine opened DD records with a View button, his links the
    number. Owner to confirm the View affordance against legacy.
  - Easwar's heavy `ethicsLinks` (full record read) → my listing-row authorisation (light, as legacy reads links
    straight away).
  - Easwar's `delete-rules.ts` → the existing `canDeleteEthics`.
  - E2E ids `#parent-due-diligence-*` → `#award-record-dd-*` / `#proposal-1000-dd-*`; `#due-diligence-print` →
    `#due-diligence-print-button`; the DD discard prompt is the in-page dialog (`#due-diligence-response-discard`).
- **Follow-up, same day (legacy check of the Link dialog and live re-run):**
  - Legacy (`awards-due-diligence-start-page.html`, the same dialog in `proposals-due-diligence-start-page.html`):
    two inside-label filters applied as each is committed (no Search button), rows with number, status, description and
    org unit, a Link button on each row, Cancel in the footer, more rows on scroll (no Previous / Next). An existing
    link warns and closes; a new one confirms, closes and re-reads. The card opens from its title and from a View
    button gated on `dd-list-view-record`, in the record's own access view (`viewButtonActionChain`). My replaced
    version matched it; Easwar's did not (Search, paging, no Cancel, bare rows, number linked without access).
    `ParentDueDiligence` now follows legacy (`linkCandidates` is a paged endpoint), and the award card opens per access
    view. Measured on 621 at 1920px: Create at the start of a 15px-margin, 9px-padded row (it was centred), title
    15px/700 as legacy.
  - Live (DEV, award 1190): the tab lists DD_402 and the new DD_403; Create opens the New page with the award as
    parent and saves DD_403 linked to the award. Link stays hidden (this user has no `awards-link-due-diligence`
    edit), as on 621. View is hidden (RB row not visible), as on 621.
  - Found live, fixed: DD and Ethics setups with no supervisor failed the whole record ("service unavailable") on a
    non-numeric reviewer id. Found live, left to Easwar (guide §13): the admin answer on create is refused (403); the
    post-create destination; the `READONLY_ACCESS` view the linked lists use (cards for it get no link until it is
    built); the proposal cards' open/View.
  - Differs from legacy, owner to decide: legacy shows Create Due Diligence to anyone who can open the award tab; ours
    (Easwar's `requireParent`) shows it only with `awards-due-diligence` edit.
  - Checks after the follow-up: `tsc` clean, lint 0 errors (1 known warning), unit 1041 passed, isolated build
    passed, e2e 84 passed.
- **Rules touched:** none changed; guide §13 records the corrections.
- **Checks:** see `docs/progress.md` (2026-11-11 rebase entry).
- **Open:** guide §13 "Still to bring onto the framework"; the award DD tab's live evidence (DD_402 from 1190) was
  taken on my replaced implementation and must be re-run on the shared one.
