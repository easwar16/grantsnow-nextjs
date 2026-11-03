# Proposal migration flow inventory

Verified 2026-10-29 against the read-only VBCS checkout at
`/Users/easwar/Developer/GrantsNow`, ref `origin/development`, and this worktree.
This is a code inventory, not a parity claim. The VBCS page HTML, page JS,
page JSON and page chains must all be checked before implementing a flow.
The live DEV app remains the visual and behavioural comparison target.
The [VBCS Proposal source map](proposals-vbcs-source-map.md) lists all 26
page templates, their local chains, literal service endpoints and navigation
targets. Its automated extraction cannot resolve dynamic endpoint names.

| VBCS flow/page                         | Next.js implementation now                                   | Remaining source-backed work                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposal start/list                    | `/proposals`                                                 | Create, copy, convert, share and delete journeys; validate listing actions against each source chain.                                       |
| Proposal info and Summary              | `/proposals/[type]/[id]`                                     | Complete edit and finalize conditions, dynamic answer save retries, and live write verification.                                            |
| Budget start                           | `/budget`                                                    | Version creation/rename/finalize, row actions and cost splits. Current tree groups by proposal and collaborator, then funding and category. |
| Budget staff, student, pool technician | Read-only `/budget/staff/[costHeaderId]`; initial add dialog | Dedicated salary model, HR fields, dynamic fields, editable cost lines, calculations, clone and delete.                                     |
| Budget non-staff                       | Initial add dialog                                           | Dedicated non-staff cost header and line editor, edit, clone, delete and calculations.                                                      |
| Budget indirects                       | No route                                                     | Source indirect cost workflow.                                                                                                              |
| Budget research partner                | Initial add dialog                                           | Partner selection, partner-scoped cost records and source editor flow.                                                                      |
| Pricing / Funder Rules                 | `/pricing` read view                                         | Edit, currency/rate selection and save.                                                                                                     |
| Allocation for Credit                  | `/allocation-for-credit` read view                           | Edit and save.                                                                                                                              |
| Inkind Contribution                    | No route                                                     | Full page.                                                                                                                                  |
| FEC Summary                            | `/fec-summary` query, table and chart                        | Live DEV comparison and chart types unsupported by the existing engine.                                                                     |
| Dynamic Forms 1–5                      | Shared dynamic form on `/[tab]`                              | Confirm all form IDs, conditions, answer writes and navigation per host.                                                                    |
| Approvals                              | Shared `ApprovalWorkflow`                                    | Source action and status parity under grants.                                                                                               |
| Attachments                            | Shared attachment host                                       | Source write actions and permissions.                                                                                                       |
| History                                | Shared history host                                          | Live field and ordering comparison.                                                                                                         |
| Delegation                             | Shared delegation host                                       | Source write actions and permissions.                                                                                                       |
| Contracts                              | `/contracts` linked read view                                | New Contract and source actions.                                                                                                            |
| Ethics                                 | `/ethics` linked view                                        | Create, link and detail flow.                                                                                                               |
| Due Diligence                          | `/due-diligence` linked view                                 | Create, link and detail flow.                                                                                                               |
| Sponsor Due Diligence                  | No route                                                     | Full page.                                                                                                                                  |
| Awards                                 | No route                                                     | Linked Award page and actions.                                                                                                              |

## Budget source facts used for the next implementation slice

- `proposals-budget-start-page.html` renders five Add Cost controls, gated by
  read access, edit status, current version, lock state, and relevant edit grants.
  It renders Show Year Split and split/combined views independently of those
  controls.
- `addStaffCostActionChain.json`, `AddStudentCostButtonActionChain.json`, and
  `addPoolTechnicianButtonActionChain.json` navigate to the staff editor.
  `addNonStaffCostActionChain.json` and
  `addResearchPartnerCostActionChain.js` navigate to the non-staff editor.
- Staff and non-staff pages each have their own header creation, cost-line save,
  edit-row, calculation, dynamic region and exit-check chains. The current
  `CostingEditor` only covers initial entry and does not replace those pages.
- Both dedicated editors save `costing_line_json` through
  `postPre_awards_costingSaveCostingDataN` and return to Budget only after a
  successful response. The staff save chain calls `hasValidStaffCostUnits`
  first: a unit type is required only when the role-specific resource bundle
  marks it mandatory. Its payload normalizes proposal and line dates. The
  non-staff payload additionally derives `baseline_cost = units × unit_cost /
exchange_rate`, sets the salary model to `COLLAB` or `NON_SAL`, and sets
  cost type to `COLLAB` or `NON_STAFF`. The current Next.js initial-add path
  does not perform this full editor save workflow.
- Source operations used by the initial add path are already named in
  `src/server/oracle/api/proposals.ts`; extending an editor must preserve the
  explicit write payloads and server authorization gates.

## Other source boundaries

- The Proposal listing (`proposals-start-page.html`) has New Proposal, Outline
  Proposal, Recycle Bin, advanced filters, and per-row save/link/share/clone/
  delete actions. Its copy, conversion, restore and delegation dialogs are
  distinct flows, not merely listing controls.
- The Proposal info page (`proposals-info-start-page.html`) owns edit/save/
  cancel, Quick Cost, FX Rates, Viability Checks, AI Summary, comparison,
  comments, audit and print. It also owns Budget version creation, rename,
  activation and deletion. These controls have separate access and state gates.
- The Inkind Contribution page has add, row edit, delete and total-save chains.
  It first loads sponsor totals and lines in parallel, then groups lines by
  sponsor. The total save posts `INKIND_CONTRIBUTION` to
  `postPre_awardPropinkind`; line saves post `INKIND_ARRAY` to
  `postPre_awardPropinkindcostline`. The line validator rejects a sponsor's
  line sum above that sponsor's total. Add, edit and delete have separate
  chains and permissions. A read-only summary table alone would not meet
  this flow's parity requirement.
  The FEC Summary page is a filterable report with query and refresh chains;
  its Generate action calls `GrantsNowChatBotService/getCostingAnalysis` with
  `user-query` and `proposal-number` headers and parses NDJSON data/chart
  chunks. It is not an editable cost table. These should use their source
  operations rather than guessed Proposal Budget data.

The next slices should each include the legacy page/chain evidence, exact
allowlisted Oracle operations, a scoped server display model, the shared
record controls, failure-mode tests and a same-viewport comparison. A read-only
page or an initial add dialog must not be marked as a complete flow.
