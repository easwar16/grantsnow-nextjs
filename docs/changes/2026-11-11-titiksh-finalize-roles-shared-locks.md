# Finalize re-reads the record roles; one shared `locks` API module; EOI Cancel Edit resets attributes

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021 (after `2026-11-11-titiksh-eoi-insert-request-post.md`)
- **Why:**
  - **Workflow tab late after Finalize (reproduced on EOI 4074):** after the lock write the page re-read the locks
    (cache trace: the held `getProposalGetLockedModules` was dropped and re-read), but the record roles came from the
    60 s held `getSecurityUser_roles`, which had no `opportunities-eoi-approvals` row yet: the backend grants that page
    once the pages are final. Workflow appeared up to a minute later. Legacy `FinalizeValueChangeChain` fires
    `application:refreshPages` → `fetchEOIPagesJS`, which loads the object roles again.
  - **Cancel Edit kept edited attribute values** (open item of the 9284 change).
- **What changed:**
  - New `src/server/oracle/api/locks.ts`: `finalizablePages`, `lockedModules`, `lockStatus`, `setLock`, each defined
    once. They were defined twice (`eoi.ts` and `proposals.ts`), and Awards imported `eoi as locks`. Callers in
    opportunities, awards, contracts, proposals (`finalize.ts`, `edit.ts`, `record.ts`) and the dynamic-form access
    now use `locks`. `setLock` also drops the held roles (`getSecurityUser_roles`), for every record that finalizes.
  - Proposals' finalizable-pages read is now held for the access TTL like the other records' (same function).
  - EOI Application tab: Cancel Edit remounts the attributes panel (the saved values return).
- **Shared pieces used or extended:** the API layer (one function per operation); `ObjectAttributes` unchanged.
- **Replaces / overrides:** the duplicate lock functions in `eoi.ts` / `proposals.ts` (Proposals is Easwar's module:
  only its imports and parameter names changed, behaviour as before apart from the held finalizable read).
- **Rules touched:** none; enforces "one function per backend operation" for the lock operations (unit test).
- **Checks:** live on DEV EOI 4074: unlock hides Workflow at once, Finalize shows it at once (before: about a minute);
  4075: Cancel Edit returns Attribute 1 to its saved value. Tests: `proposal-finalize` mock moved to `locks`; new
  catalogue test that the four lock operations live only in `locks.ts`. Typecheck clean; lint 0 errors (the existing `react-hooks/incompatible-library` warning); `npm test` 109 files / 992 tests; isolated build OK; `npm run test:e2e` 48 passed (2026-11-11).
- **Open (for the owner):** other operations are still defined more than once in `src/server/oracle/api`
  (listed in `docs/progress.md`, 2026-11-11).
