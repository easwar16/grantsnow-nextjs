# Shared DataTable, pinned row actions, read-only label-value fields, skeleton strategy, subtle presses

- **Date / author / agent:** 2026-10-29 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on af86ddf
- **Why (owner requests, 2026-10-29):** the Awards project-cost "Edit Global" button was off-centre; row actions
  (edit, delete) should always be frozen to the row's end; read-only fields should look like label-value pairs, not
  form controls; the button press was too bouncy; Awards details showed a list skeleton, so a skeleton strategy was
  needed "once and for all"; and a reusable table component for flat and hierarchical tables, taking columns, data
  and actions, with every operation in the parent.
- **What changed:**
  - Edit Global: the actions row spanned one grid column (the spanning rule targeted `.actions`, the row is
    `.globalActions`), so it centred on the form's left half. The rule now targets `.globalForm .globalActions`.
  - Row actions: `.gn-table-actions` (globals.css) pins the action column to the row's end (`position: sticky`,
    `inset-inline-end: 0`), sized to its buttons, on the row's own background. Scrolling tables layer the header
    (`z-index` 2) and its actions corner (3) above the pinned cells. Every table's action header and cells carry it.
  - Read-only: the global `.gn-control[readonly]` and the `InsideField` box around a `readonly` control draw no box,
    so computed values (installment totals and balances, the chosen PI's org unit and employee number, the credit
    row's person) read as label and value. The Awards header, while editing, renders each non-editable field as a
    `ReadonlyField` instead of a disabled Select / DateInput / read-only input.
  - Presses: one token, `--gn-press-scale: 0.99` (was `scale(0.97)` on buttons and `0.92` on the date button).
  - Skeletons: `RecordSkeleton` (a list placeholder whose name invited its use on record pages) is now
    `ListSkeleton`; new `FormSkeleton` (the field grid `DetailSkeleton` already drew). Record routes now use
    `DetailSkeleton` above their layout and `FormSkeleton` for a tab (Awards, Contracts, EOI, Apply, More Info,
    the EOI denied redirect). The strategy is written in skeleton.tsx and the foundations.
  - DataTable (`src/components/ui/data-table.tsx`): columns, rows, `rowKey`, `childrenOf` (a tree: expanders,
    `aria-level`, `role="treegrid"`, starts expanded), `actions` (pinned icon buttons that call the parent),
    `empty` / `emptyId`, column footers, `height` (the `.gn-table-scroll` variants), `rowIds`, `rowClassName`,
    `rowLabel`, `indent`, `actionCell`, `renderRow`, `actionsClassName`, and per-action `title` / `size` /
    `className`. A column's `className` applies to its header, cells and footer.
    - On it (15): Awards credit, budget periods, header periods, milestones, report years, projects, project team,
      installments (tree), project costs (tree) and the cost dialog's periods; FX rates, dynamic-form grid, Advanced
      Query conditions, object history (both), approval workflow history, approvers dialog.
    - Then the last four (owner: "all tables throughout app should use the DataTable"): the Project Report
      actuals by month (a tree whose group rows span columns: new `TableColumn.span`), the profile dialog's proxies,
      Contracts signers and deadlines (server pages pass plain data to the client `SignersTable` / `DeadlinesTable`,
      keyed by position, never by email), and the insight chart's data disclosure. Their own table CSS (Contracts'
      `#345257` header and borders, `.insight-data` cells, the actuals' expander and node rules) is gone; they look
      like every other `.gn-table`. No raw `<table>` is left outside DataTable.
    - Ids kept throughout; added: empty-row ids, `award-header-periods-table`, `award-report-years-table` and its
      rows, `award-team-project-<id>-table`, dyn-grid rows (`<id>-row-<i>`) with per-row Done / Cancel.
    - Small visible changes: number headers right-align with their columns; a tree line's first cell is a row
      header; an installments category with no items shows no expander; dyn-grid's empty row uses `.gn-table-empty`;
      the history comment's tooltip now comes from TruncatedTitles only when it is cut.
  - Rules written: foundations (tables, read-only, skeletons, presses), agent-guide §3 table, AGENTS.md.
- **Shared pieces used or extended:** `ReadonlyField`, `InsideField`, the skeleton module, `.gn-table`,
  `.gn-table-scroll`, `Icon`, `functions.ids.idPart`.
- **Replaces / overrides:** per-table `<table>` markup and per-module expander / action-cell CSS; `RecordSkeleton`
  on record routes; disabled controls for non-editable header fields; the 0.97 / 0.92 presses.
- **Rules touched:** read-only display, loading states, tables, motion.
- **Checks:** `tsc --noEmit` clean; lint 0 errors (1 existing warning); `npm test` 79 files / 843 passed (new:
  data-table cases); Prettier clean. Live DEV, award 1183 Project Costs: the cost tree on DataTable (treegrid, 8
  pinned action cells, text at 30 / 49 / 60 px as legacy), the Edit Global spanning rule loaded (this award's gate
  hides the button, so its centring was not seen live). Isolated build passed; `npm run test:e2e` 20 passed, 2
  skipped, 0 failed (4.0 min).
- **Guided learning e2e** (open item of Ayush's record): `Guided learning: the Dashboard tour starts once, steps,
closes, and a single guide runs from the menu` (passes alone in 19 s).
- **Live DEV checks:** Edit Global on draft award 1181 centred on the form (centres 1067 / 1067, width 501 of 2101,
  legacy's quarter); the finder's shell at 0.8 s, options at 3.2 s, cards at 5.3 s, banner shown, no error toasts;
  Proposals' five choice groups as separate 200s (0.4-3 s) and 10 of 1,362 rows; award 1183's approval history in
  its own table (8 rows, `view=history`), budget periods (4 rows, pinned actions, totals footer), both history
  tables, installments' read-only totals without a box. Not seen live: the actuals tree's spans (award 1183 has
  no report data; covered by a unit case).
- **Open:** none from this change. The listing's org default stays off (owner, 2026-10-29).
