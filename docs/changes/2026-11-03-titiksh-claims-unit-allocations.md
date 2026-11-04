# Claims Unit Summary: Fund Allocations; award Created by (9412); development checklist

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 75b144c (uncommitted work from 2026-11-02 underneath)
- **Why:**
  - **Checklist (owner request):** one list of what is built and tested, checked at the start of every session.
  - **9412 (legacy `9d18ca74d`, on `development`):** the award's "Created by" is `award_summary.created_by`. Before,
    legacy showed the PI, and the rebuild copied that.
  - **Allocations:** the next step of the Unit record's Summary. Legacy `claims-unit-summary-start-page`:
    `openAllocations`, `loadAllocations`, `saveAllocation`, `deleteAllocation`, `cancelEditAllocation`,
    `allocationsDialogClose`, the `allocation` column's button gate, and the info page's `loadStatusConfig`.
- **What changed:**
  - **`docs/checklist.md` (new):** per module, the status and evidence of each item, the legacy watermark, legacy
    tickets to carry, and Next up. `AGENTS.md` step 1, `CLAUDE.md` and agent guide §1 now list it.
  - **Award Created by:** the panel and the creator card use the `created_by` person, not `pi_pid`.
  - **Fund Summary:** each fund has the Allocations button. It is enabled with the `unit-fund-allocations` edit
    right and a fund status that allows a user edit as a fund or an amendment (legacy `statusConfig`, from
    `getClaimsStatusConfigs`; any `Y` row for a status allows it). If the config read fails, the buttons stay
    disabled and the summary still shows.
  - **Fund Allocation dialog (50vw):**
    - Add New opens the add form (Allocation Type from `FPCG_ALLOC_TYPE`, date, amount).
    - The table shows type, status, date and amount, with each header's More Info. A row's Edit edits type, date
      and amount in place, with ✓ and ✕; Delete removes the row.
    - Every change reads the list again. Closing the dialog reads the Fund Summary again.
    - Toasts are legacy's literal ones: "Allocation created successfully!", "Allocation updated successfully!", and
      "Allocation amount cannot be negative." for a negative amount, which is refused before sending.
  - **Server:** `record/allocations.ts`. The dialog read, `saveAllocation` and `deleteAllocation` check that the fund
    is one of this application's funds, and the writes also check that the allocation is one of that fund's. The
    writes check the same gate as the button. A new allocation posts only type, date and amount. An update puts the
    row as read (legacy `fundAllocationType` columns only) with those three replaced, and an unchanged date keeps
    its stored value.
  - **Allowlist / API:** `getClaimsStatusConfigs`, `getFundAllocations`, `postFundAllocation`, `putFundAllocations`
    and `deleteFundAllocation` (`claims.statusConfigs`, `fundAllocations`, `createAllocation`, `updateAllocation`,
    `deleteAllocation`). The writes invalidate the allocations, the fund summary and the listing.
  - **Route:** `/api/claims/units/[id]/allocations` (GET `?fund=`, POST save, DELETE).
- **Shared pieces used or extended:** `ActionDialog`, `DataTable` (row actions), `Select`, `DateInput`,
  `InsideField`, `HelpButton`, `useApi`, `useInFlight`, `useToast`, `useActionFailure`, `functions.format`;
  `Icon` gains `manage-allocations` (legacy's glyph).
- **Replaces / overrides:** the award panel's "Created by" was the PI (as the old legacy did); 9412 makes it the
  creator. The Fund Summary's empty Allocations cell now holds the button.
- **Legacy differences:**
  - Legacy's row Delete toasts "Unable to delete allocation" on failure; here the failure shows the backend error.
  - Legacy reads every claims status config on the info page and passes it to each tab. Here the Summary reads it
    with the fund summary, and each write reads it again to check the gate.
- **Rules touched:** none.
- **Checks:**
  - typecheck clean; lint 0 errors (the existing warning); 93 files / 906 unit and integration tests (5 new in
    `claims-unit-allocations.test.ts`; the award creator test now proves `created_by` wins over the PI).
  - e2e "Claims Unit record" passes on fixtures. It covers the disabled button on an IA fund; add, edit and delete
    of an allocation; the toasts; and close. Isolated build passed; full e2e 31 passed, 2 skipped, 0 failed.
  - **Not yet seen live:** the allocation reads and writes, and the award `created_by` on DEV (no dev session was
    running).
- **Open:** the Allocations audit button (`audit-trail-allocations`, a `claim-allocations` audit with the fund as
  secondary object): the shared audit drawer has no secondary object yet. Then stakeholders, meetings, documents,
  exports, Assurance.
