# Edit mode hides Comments, Audit and Finalize; award Save Header; LOVs blank an unmatched value

- **Date / author / agent:** 2026-11-02 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c
- **Why:** owner report (2026-11-02):
  - Awards has no Save at the bottom.
  - Comments and Audit must not open in edit mode on any object, and Finalize must be hidden in edit mode.
  - Dynamic-form and attribute LOVs show a wrong value. Checked on live 621, award 1188: Attribute 5 stores `AASU`,
    its only option is `1188`, and VBCS shows it blank, while the rebuild showed `AASU`. The owner asked for that
    behaviour on every LOV in the app.
- **What changed:**
  - **Award header Save Header:** a centred **Save Header** button below the dynamic form while editing (legacy
    `awards-header-start-page.html` `btnSaveAward`, label `award.labels.save-header`). It runs the same save as the
    toolbar Save (`saveAwardHeader`) and is disabled while the save runs or the page is locked.
  - **`RecordFrame` `editing` prop:**
    - While editing, Comments, Audit Trail and Finalize are not rendered, and entering edit mode closes an open
      drawer.
    - Awards and EOI pass their edit state. Awards' Finalize was previously read-only while editing; it is now hidden.
    - Proposals' own Finalize (not yet on `RecordFrame`) is hidden under `?mode=edit` instead of disabled.
  - **`Select` / `MultiSelect`:**
    - A value that is not among the options shows blank: an empty field, and no chip, summary or count entry.
    - Previously the raw value was shown. Attributes' read-only text follows the same rule.
    - The dynamic form's read-only LOV text already did this.
- **Shared pieces used or extended:** `RecordFrame`, `Select`, `MultiSelect`, `ObjectAttributes`, `record-tab.module.css`
  `formActions`.
- **Replaces / overrides:**
  - The raw-value fallback in `Select` / `MultiSelect` (from the Opportunities port, 67b3484; no recorded reason).
  - Legacy kept Comments visible and only hid Audit Trail in edit mode, and showed Finalize read-only. The owner's
    rule is stricter and wins.
- **Rules touched:** none.
- **Checks:** typecheck clean; lint 0 errors (the existing warning); 91 files / 894 unit and integration tests (3 new
  for the selects). Isolated build passed.
  - **e2e:** 29 passed, 2 skipped, 1 failed. The EOI journey clicked Finalize in edit mode to get "Can't Finalize".
    It now asserts that Finalize and Comments are hidden while editing, and passes alone.
  - The refusal itself stays: dynamic-form tabs edit without an edit mode, so Finalize can meet unsaved answers there.
  - **Live DEV:**
    - Award 1188: attributes match VBCS 621 both read-only and in edit mode (Attribute 3 `FINALCR`, Attribute 5
      blank).
    - Award 1188 Edit: Comments, Audit and Finalize gone, Save Header shown and enabled; after Cancel they are back.
      Nothing was saved.
    - Dynamic-form LOVs on awards 1178 and 1180 already matched (stored ids `2006` → "Two", `1907` → "Strategy and
      Goals"). Picking "Three" showed "Three"; it was not saved.
- **Open and decided:**
  - Decided by the owner (2026-11-02): a dependent attribute with an empty parent lists no options, as the dynamic
    form does, although legacy's app-level `getOptions` lists every option. `tests/unit/attributes-fx-model.test.ts`
    asserts it.
  - Three read-only cells still show the raw code when it has no label, as legacy tables do:
    - the dynamic-form GRID LOV cell (legacy `oj-combobox-one`);
    - the Awards Advanced Query chips;
    - the Proposal deadline type and Awards unit type cells.
  - DEV returns the award's own id as Attribute 5's only option (backend data).
