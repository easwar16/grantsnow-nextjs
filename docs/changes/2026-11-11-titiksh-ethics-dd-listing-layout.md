# Ethics and Due Diligence listings: no side gutters, stretched access tabs, one shared card

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021
- **Why:** owner, 2026-11-11: "the ethics listing page doesn't look right, there're gutters on either side, and top
  tabs doesn't look right … check for that in DD as well". Measured against VBCS 621 at 1920 px:
  - `main` had 36 px padding on both sides: the app shell gives the edge-to-edge workspace only to Proposals,
    Opportunities, Contracts, Awards and Claims. 621: filter panel at x=0, list to the right edge (its own scrollbar).
  - Access tabs were left-aligned (`align="start"`); legacy is a plain `oj-tab-bar` in an `oj-flex-item`, which
    shares the width (621: three tabs, 24 px apart, centred names).
  - Due Diligence cards: classes missing from its CSS (a copy of Ethics'), so the fields stacked as "Created byBrock";
    raw ISO dates; actions beside the number; Create in the middle of the toolbar; a response-status chip legacy does
    not show; the reviewer labelled `list-supervisor-name` where legacy's card uses `list-reviewer`.
- **What changed:**
  - `app-shell.tsx`: `/ethics` and `/due-diligence` get the edge-to-edge workspace.
  - Both listings: `TabBar align="stretch"`; content padding `12px 0 28px 14px` (the list runs to its scrollbar).
  - New shared `ApplicationCard` (`src/components/ui/application-card.tsx`): number link and chips (`StatusBadge`,
    legacy status and risk tones), title, `RecordMetadata`, row actions centred at the right edge. Ethics and DD pass
    data only; ids kept (`<m>-open-<id>`, `<m>-metadata-<id>`, DD's links / clone / delete).
  - DD: legacy card field order, dates through `functions.format.dateDisplay`, Create beside the panel toggle, no
    response chip, reviewer key `list-reviewer` (fixture row too). Unused card CSS removed from both modules.
- **Measured after:** panel x=0; list and tabs from x=254 (621: 256); DD cards to x=1905 (621: 1905); tabs 530–534 px
  each, 24 px apart.
- **Checks:** Typecheck clean; lint 0 errors (the existing warning); `npm test` 109 files / 992 tests; isolated build OK; `npm run test:e2e` 48 passed, including the Ethics and Due Diligence journeys (2026-11-11).
- **Shared pieces used or extended:** `ApplicationCard` (new), `StatusBadge`, `RecordMetadata`, `TabBar` stretch.
- **Replaces / overrides:** the two module card copies (Easwar's modules; layout only, data unchanged).
- **Rules touched:** none.
- **Open (legacy differences seen, not changed):** 621's Ethics cards also show link / copy icons (not built here);
  621 shows a "Filters" heading in the panel and "10 of N" under the list.
