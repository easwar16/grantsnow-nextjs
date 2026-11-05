# Chart legend, record tab arrows, hide-not-disable sweep, rest of the visual pass

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c (uncommitted work underneath)
- **Why:** owner requests in the session, and the open visual-pass items, checked against VBCS 621.
- **What changed:**
  - **Chart legend (owner):**
    - Every `InsightChart` (Home Insights, Analytics, the award report chart) draws its legend as one HTML list beside
      the plot. The legend is the same width everywhere (9.5vw, at least 120px) and as tall as the plot.
    - A long legend scrolls, with its scrollbar hidden, instead of ECharts' page arrows.
    - Clicking an entry hides or shows its series (ECharts' legend stays hidden and takes the toggle). The button's
      `aria-pressed` follows.
    - `functions.charts.legendItems` replaces `legendTextWidth`. The plot no longer reserves 30–35% for a legend.
    - A plain pie (`insideLabels`) is centred with a 74% radius, and its percentages take black or white text by slice
      colour, as JET does. `legendTitle` titles the legend (Analytics: "FundingType"); unnamed slices then have no entry.
  - **Record tab bar (`RecordTabs`, owner):** the scrollbar is hidden. Arrows appear at an end with more tabs; the
    wheel scrolls sideways; the current tab is brought into view.
  - **Hide, not disable (owner rule, now in AGENTS.md, the foundations and agent guide §5):** a control the user
    cannot use because of access, RB visibility or editability is not rendered. `disabled` is only for a passing
    state. Moved from disabled to hidden:
    - **Award:** header Edit / Save / Save Header when locked; Budget, Credit, Periods, Projects, Milestone and cost-line
      row actions without the edit right or on a row that is not editable; the cost-line menu shows only the actions
      the user has; New Installment without edit; Add Milestone without the right.
    - **EOI:** Edit / Save as Draft / Cancel and the Application Save when locked.
    - **Claims:** the Allocations button on a fund the user cannot allocate; Unit dialog fund-row Edit / Delete on a
      fund past an editable status.
    - **Shared:** the comment composer without the comment right; delegation Add, Edit access, delegate Delete and
      page Remove without their rights or on a locked page.
  - **Approval history comments:** legacy trimTextContent: the first 35 characters and "…" as a link. The whole
    comment (sanitised HTML) opens in the shared dialog ("Comments", RB `dialog-titles.comments`). This replaces a CSS
    ellipsis at 320px.
  - **Attachments detail pane:** legacy's 45px field pitch, with an empty value keeping its line. The Download button
    is removed: legacy has Preview and Delete, and a double-click downloads, as here.
  - **Dimension dialog:** legacy's labels "Cols" and "Rows" (required). The 1–12 / 1–3 range stays as the inputs'
    bounds; it guards the 12-column tile grid.
  - **Chatbot:** the message time uses the new `functions.format.clockDisplay` (legacy getCurrentTime, `h:mm AM`), not
    `toLocaleTimeString`. Quick replies have ids. The notification bell's times use it too, with legacy's `hh:mm a`.
- **Shared pieces used or extended:** `InsightChart` (HTML legend), `functions.charts.legendItems`,
  `functions.format.clockDisplay`, `RecordTabs`, `ActionDialog`, `DataTable` `hidden` actions.
- **Replaces / overrides:**
  - ECharts' scroll legend and its truncation helper.
  - The disabled-for-rights controls listed above. Where legacy disables for access or editability, the owner's rule
    wins.
- **Rules touched:** new rule "unavailable controls are hidden, not disabled" (owner, 2026-11-03).
- **Measured, no change:** Insights charts are 153px tall as legacy. Legacy's inner panel is 14px wider than its
  tile (padding and border overflow); that overflow is not copied.
- **Checks:** see `docs/progress.md`.
- **Later the same day (owner):**
  - **Delegation access switches** are hidden without the edit right or on a locked page.
  - **Allocation dialog:** its loading frame takes the 75vh height, so the dialog does not jump.
  - **`Select` / `MultiSelect`:** the field, chips and summary show a tree option's label without its indent (org units
    carry their depth as leading spaces); the list keeps it.
- **Live DEV writes (owner approved; DEV data is test data and is left as it is):**
  - **App 1065 Summary Save:** every sign-off field filled; saved, re-read and persisted across a reload. VBCS 621
    shows the same values.
  - **App 1065 fund 966 allocation:** create (Other Adjustment, 03-Nov-2026, £100), row edit to £150 and delete, each
    re-read correctly.
  - **Award 1190 header:**
    - Save Header with Attribute 3 = Donation was first refused ("Please fill all the required fields": Actual Award
      Date and Assigned To are required).
    - Saved once both were filled. Attribute 3, Actual Award Date and Assigned To persisted across a reload, so
      attributes now persist on the backend.
- **Open:**
  - **Proposals (Easwar's)** still disables for rights in places: Finalize when not editable, sponsor Delete, AI
    compare.
