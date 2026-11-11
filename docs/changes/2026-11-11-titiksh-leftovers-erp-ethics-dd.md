# Leftovers: Send to ERP as legacy, Ethics card actions, the award Due Diligence tab, live Reject / Rework

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021
- **Why:** owner, 2026-11-11: "complete the leftovers, wire the send to ERP as it is in legacy app, and leave it to
  manual testing".

## Send to ERP (Awards)

- Already wired (record toolbar button, `POST /api/awards/[id]/erp`, `custErpDetails` AWARD, the OIC flow with
  `{AwardId, Token}`, the flow's Status as the toast, the award re-read). Brought to legacy's gate: legacy
  `btnSendToERP` shows on every tab of an internally approved award to anyone who can open it; the rebuild had also
  required the header page's edit right (an approved award has none, so the button never showed). Kept: an unknown
  `erp_type` answers with a message (legacy did nothing), and the flow path is checked.
- **Not run live** (owner: manual testing).

## Ethics listing card actions (legacy ethics-start-page)

- Link (RB `list-link`): the shared linked-objects dialog (`getSharedObjectLinked2`, ETHICS).
- Clone (`ethics-clone` grant, RB `list-clone`, administrator or respondent view): legacy dialogCopyEthic — the copy
  objects with "Entire Ethics", defaults ticked, `postDynamicFormsCopyApplication`.
- Delete (`ethics-listing-delete` delete grant, RB `list-delete`, legacy `checkDeleteEthicsConditions`, now
  `src/shared/ethics/listing.ts`): the legacy warning, then `deleteDynamicFormsApplicationSetup`; checked again on the
  server from the record's listing row.
- Shared pieces: `CloneApplicationDialog` (`components/dialog`, on the existing `CloneParts`) and
  `LinkedObjectsLoader` (`features/record/linked`), both used by Ethics and Due Diligence; Due Diligence's own clone
  dialog, linked-dialog wrapper and literal texts replaced (RB labels: `clone-dd`, `entire-dd`, `listing-delete-warning`,
  `listing-permanent-delete`, `listing-delete`, `listing-cancel`). Clone part ids are now
  `<m>-clone-dialog-part-<value>` (shared `CloneParts`); the DD e2e follows.

## Award Due Diligence tab (legacy awards-due-diligence)

- View per record (RB `dd-list-view-record`): the DD record in the row's own access view.
- Create (`create-duediligence`, shown with the DD create grant): the DD New page with the award as reference; the
  save sends `obj_ref_id` / `obj_ref_type: AWARD`, `enabled_by: PROPOSAL` and the award in `reference_objects`, as
  legacy's newReference; the server checks the award's Due Diligence tab. The record opens in the participant view.
- Link (`awards-link-due-diligence`, hidden without edit): legacy dialogLinkDueDiligence — DD records in the user's
  view (getDDAccessType) by number and description; LINK keeps the record's existing references (with `reln_id`) and
  adds the award; an existing link warns instead (`dd-already-linked`).
- Route `GET/POST /api/awards/[id]/due-diligence`; integration tests (reference set kept, no double link, no grant).

## Live DEV (2026-11-11)

- Verdicts: EOI 4094 (AOI_525) **Rejected**, EOI 4095 (AOI_526) **Rework** ("Sent for Rework"), each after create,
  answers, Finalize, Generate and Submit, with history rows and comments. Approve ran on 4076 earlier. After Rework
  nothing is editable (legacy `editableStatuses` is DRFT only: same).
- Award 1190 Due Diligence tab: Create Governance shown (RB label), empty text; Link hidden for this user.

## Found in the sanity pass and fixed

- **Listing Link took 50 s+ and showed "Link" as the title.** Ethics' (new) and Due Diligence's (existing) Link scoped
  the whole record first (every access list, setup, roles: roles alone ~20 s on DEV). Legacy reads the links straight
  from the row. Now the record must be in the user's listing view for that tab (one listing read, ~2.5 s), then
  `getSharedObjectLinked2` (backend 15–75 s). Clone and Delete keep the full record check (they write). The dialog
  title is `dialog-titles.linked-objects` (legacy), not the button's label. Live: Ethics 3180 → "Linked Objects",
  "No Linked Data".
- Sweep results (all 200, no error states, no server or console errors) and the backend's slow calls are in
  `docs/progress.md` (2026-11-11).

## Checks

Typecheck clean; lint 0 errors (the existing warning); `npm test` 110 files / 995 tests; isolated build OK;
`npm run test:e2e` 49 passed (2026-11-11). One earlier full run failed `zz-proposal-create` once while the live sweep
was loading the machine; alone it passed 4/4, and the final full run passed (the known slow-dev-server flake, guide §12).

## Live run (owner, 2026-11-11: "do the live run")

- **Ethics Clone:** ETH_2692 (3180) → dialog "Clone Ethic", "Entire Ethic", Ethics Details ticked by default → clone
  **ETH_2693 (3181)**, Draft, listed at the top with Link / Clone / Delete.
- **Ethics Delete:** ETH_2693 → the bundle's warning with the number → deleted, gone from the list.
- **Ethics recycle bin is empty in both apps:** after the delete, `getDeletedApplicationList` answers
  `{"items":[],"hasMore":"true"}` with or without `p_obj_type`, and VBCS 621's own Ethics recycle bin shows "No data
  to display" (backend). The rebuild now sends what legacy sends for Ethics (no `p_obj_type`; DD keeps
  `DUE_DILIGENCE`).
- **Award Due Diligence Create:** a DD created with the award 1190 reference → **DD_402 (3182)**, saved with
  `obj_ref_id 1190 / AWARD`, shown on the award's Due Diligence tab at once.
- **Award Due Diligence Link:** this user has no `awards-link-due-diligence` edit, so the button is hidden and the
  server refuses search and link (403); the LINK write is covered by integration tests only.
- **View** on the award tab is hidden: `labels/button-labels.dd-list-view-record` is not visible on DEV (legacy hides
  it too).

Final checks after the live run: typecheck clean; lint 0 errors; `npm test` 110 files / 995; isolated build OK; `npm run test:e2e` 49 passed.
