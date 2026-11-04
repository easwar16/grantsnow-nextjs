# Rebase onto `118d553`; incoming Proposals, Ethics and Due Diligence work checked against the framework

- **Date / author / agent:** 2026-11-04 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `118d553` (`origin/main`, Easwar via Codex: "Integrate proposal, ethics, and
  due diligence work after Azure sync", 103 files)
- **Why:** the rebase procedure (guide §2): bring incoming work onto the rules, and the owner's uncommitted work onto
  the incoming tree.
- **What changed:**
  - Conflicts (stash re-applied): `icon.tsx` and the fixture write list kept both sides; the fixture RB rows kept
    both (Ethics/DD/Proposal button labels and the Opportunities `share-comments` row); `progress.md` kept both.
  - **Proposal tabs:** Easwar's finalized tick (`2026-11-03-easwar-proposal-finalized-tab-indicator.md`) is carried
    as `finalized:` on the shared `RecordTabs`. His hand-built tab markup and `.tabs` / `.tabFinalized` CSS stay
    replaced by `RecordTabs`. `.finalizedBy` is kept.
  - **Route folder (§4):** `proposals/new/[type]/proposal-create-form.tsx` and its CSS moved to
    `src/features/modules/proposals/listing/`.
  - **`Intl` in a module (§5):** the share-document `curr_symbol` now comes from the new
    `functions.format.currencySymbol` (same `formatToParts()[0]` as legacy `shareDocButtonActionChain.js`).
  - **Hide, not disable (owner, 2026-11-03):** the listing card's Clone (child proposal) and Delete (not a parentless
    draft), and the recycle bin's Restore (`!canRestore`), are now not rendered. Before, they were disabled. The
    e2e journey now expects `#proposal-proposal-1001-delete` to be absent.
  - **Ids:** status tabs, type radios, reference/search/tags/date filters, Clear filters, Retry load more, the clone
    dialog's checkboxes and buttons, the share-document buttons, and the Ethics/DD type radios.
- **Shared pieces used or extended:** `RecordTabs` (`finalized`), `functions.format.currencySymbol` (new),
  `functions.ids.idPart`.
- **Replaces / overrides:** the Proposal tab markup from the finalized-tab record (behaviour kept); the disabled
  card and restore controls from `2026-11-02-easwar-proposal-list-record-actions.md` (the hide rule postdates his
  base, so this was not his error).
- **Rules touched:** none overridden. Guide §4, §5, §9 and the new §11 spell out what Codex missed (below).
- **Checks:** see `docs/progress.md` (rebase 2026-11-04).
- **Ethics and Due Diligence brought onto §4 (same day, owner: "bring it up to speed, and leave instructions"):**
  - browser `listing/` (`<m>-list.tsx`, `new-<m>.tsx`, `schema.ts`, own CSS each) and `record/`
    (`record-shell.tsx` on `RecordFrame`, `overview-tab.tsx`);
  - routes `(list)`, `(list)/new`, `(record)/[id]`, plus `loading.tsx` and `error.tsx`;
  - server `actions.ts` (create + recycle merged; restore validates its body) and `record/shell.ts`;
  - API `actions/[action]` (GET `create`, `form`, `recycle`, DD `people` / `supervisors`; POST `create`, `restore`);
  - access tabs on `TabBar` (ids kept);
  - record panel and overview labels from the legacy keys (`ethics-detail-*` / `dd-detail-*`, `setup-project-title`
    / `dd-project-title`, `application-type`, `form-type`, `org-unit`, `deadline-date`, `expiry-date`,
    `participants`, `supervisor`). Each is gated `is_visible === 'Y'`, and the fixtures grant them. The tab name is
    `page-name.<m>-general-overview`; dates are formatted;
  - the New pages take their labels from the create setup (same keys), and loading shows a skeleton.
  - URLs `/ethics`, `/ethics/new`, `/ethics/<id>?access=` are unchanged, as are the e2e ids.
- **Proposals API:** `create/`, `advanced/` and `list-actions/` → `actions/[action]`. Body validation moved from the
  route to `list-actions.ts` (`proposalListWrites`). The e2e direct calls use the new paths.
- **Codex instructions:** guide §4 (layout from the first increment, record shell, own files only, routes only
  dispatch), §5 (RB labels on every page, `TabBar`, fix your own findings), §9 (commands that catch each of these),
  §11 (what was corrected and why); `AGENTS.md` step 5.
- **Open (Easwar's area):**
  - Ethics/DD tabs beyond General Overview (responses, attachments, approvals, history), comments and audit, and
    legacy getTabs' rule (overview tab only when the setup is a draft or the view is admin);
  - Proposals server still flat and `components/` (§10);
  - native date inputs on the Proposal and Contract listings and on Contracts New.
