# Claims Unit record: the rest of Summary, Goals, Attachments, audit trails

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c (uncommitted work underneath)
- **Why:** owner: "complete rest of the claims module". Legacy `claims-unit-summary`, `claims-unit-goals`,
  `claims-unit-attachments` (9272) and the info page's `openAudits` / `loadAuditData`.
- **What changed:**
  - **Sign-off lists** (`record/sign-off.ts`, `record/sign-off-lists.tsx`; the read moved here from `summary.ts`):
    - Shown with the list's `unit-add-stakeholder` / `-meeting` / `-document` edit right on an editable summary (legacy
      `isEditable`: both fund configs loaded and every fund's status editable). Otherwise there are no controls.
    - **Stakeholders:** Add in a dialog, edit in the row, Delete. The write sends legacy's four keys.
    - **Meetings and org documents:** Add and Edit in a dialog, with one optional file stored first under
      MEETING / ORG-DOC, then the row with its `attachment_id`. Delete takes the file with it. A row's file name
      downloads it.
    - **Stakeholder Export and Sign-In Sheet:** `claims-export` read, and a list with rows (`report-vbcs-stakeholders`,
      `-sign-in-sheet`).
  - **Assurance sign-off tab:** the shared `DynamicForm` (CLAIMS / SUMMARY-ASSURANCE) on the application's ASSURANCE
    requirement. Submit Assurance (editable summary only) saves or creates the requirement first, then the answers
    under its id. The dynamic-form access has a CLAIMS branch: Summary read, the requirement must be the
    application's, and edit needs an editable summary.
  - **Goals tab:**
    - The fund picker; the goals table; Add Goal (`unit-add-goal` edit and the fund's status available, legacy
      `isAvailable`); edit or view; and Delete, which is hidden on a goal linked to an activity.
    - The dialog: the fund (read-only), the fiscal year (fixed once saved), the fund goal from the type's goals for
      the year, the description (read-only for a SYSTEM goal), evaluation, reviewer comments, and the linked
      activities with a total.
    - The number, category and (for SYSTEM) description come from the offered goal, never the browser.
  - **Attachments tab:** the shared panel on the application (CLAIMS), upload and delete with the tab's edit right.
  - **Audit trails:**
    - The Summary's Audit Trail (view mode), each fund's allocations audit, Goals' fund audit and Assurance's. Each
      sits behind its RB row.
    - They open in `RecordFrame`'s drawer through the new `useRecordAudit()`.
    - The audit read takes legacy's secondary object (`p_sec_obj_type` / `p_sec_obj_id`).
    - A CLAIMS panel host checks the fund or requirement belongs to the application.
- **Shared pieces used or extended:**
  - **New:** `FileDrop` (the attachments panel uses it too), `readUpload` (the files route uses it too),
    `storeFile` / `scopedDownload` / `scopedDelete`, `useRecordAudit`.
  - **Extended:** `RecordFrame` (an empty comments label hides Comments), `ObjectAudit` / `objects.audit` (`sec`),
    panel hosts (CLAIMS), dynamic-form access (CLAIMS).
  - **Status helpers:** `record/status.ts` (`statusConfig`, legacy `isAvailable`), shared by allocations and goals.
- **Replaces / overrides:**
  - The sign-off lists were read-only.
  - `uploadFile`'s body is now `storeFile`, which it calls; its behaviour is unchanged.
  - The attachments panel's own drop zone is replaced by `FileDrop`.
- **Legacy differences:**
  - Deleting a meeting or document also removes its attachment record (legacy removed only the stored object).
  - Legacy disables controls for rights; here they are hidden (owner rule).
- **Live DEV (owner approved; test data left as is):**
  - App 1065: stakeholder add, row edit, export; meeting with a file, then delete; org document with a type and
    file.
  - App 1065: Assurance submitted (requirement 785, answers and file persisted across a reload).
  - App 1065: goal add, edit and delete on TITLE II; allocations audit shows the earlier allocation edits.
- **Checks:** see `docs/progress.md`.
- **Open:** Activities, Claims and the Unit approvals; the Funds record's approvals, awards and dynamic forms.
