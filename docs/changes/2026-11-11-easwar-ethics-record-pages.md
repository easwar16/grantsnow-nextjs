# Ethics record pages and recycle bin — 2026-11-11

## Verified VBCS behavior

- The signed-in DEV VBCS preview showed the Ethics record header as three columns: title/number/status, org/risk, and deadline/type/creator. The Approver view of ETH_2683 (setup 3170) has Responses, Attachments, Approvals, and History tabs, with three pending approval stages. Its status label is the selected stakeholder's `Awaiting Internal Approval`, while the setup's Administrator view lists the record as `In Progress`.
- `ethics-detail-page.js` filters navigation by object-scoped read rights and includes Approvals when granted. The Approvals screenshot compared ETH_2683 in Approver view against ETH_2685 in Next.js, so its missing tab was a record/access mismatch rather than evidence that the workflow host was absent.
- The VBCS Setup page embeds the shared ETHICS dynamic form beside a participant/supervisor rail. Attachments places the folder tree and document details side by side and has no participant rail in the supplied Administrator screenshot. The recycle dialog uses a tall 600px panel, a large list region, and `helper-texts.no-data` for empty data.

## Implemented

- Ethics record routes now use the full-width workspace. The shared record frame renders the Ethics header in three columns and displays the selected stakeholder's response status outside Administrator access. Creator names are resolved from the server-side people read. Ethics tabs and status/risk badges use the VBCS surface and status tones.
- Setup now reads the configured ETHICS form through the shared dynamic-form host and displays it with the participant/supervisor rail. The record routes preserve participant and tab deep links; Attachments gets the full content width for its shared tree/detail host.
- The existing shared Approvals workflow is verified on the same live DEV ETH_2683 Approver record: route, three stages, participant rail, and history load. The object-scoped role gate remains in place.
- Reworked ETH_2685 initially failed to load History because Oracle returned status rows bearing other participant/setup IDs from the same Ethics record. The shared History host now accepts only the IDs verified from that setup, and rejects foreign IDs. Its live DEV status timeline and approval history load after the change.
- The recycle dialog now follows the VBCS geometry and empty text, displays deleted record metadata, hides Restore without the `ethics-recycle-restore` right or for a linked Proposal, and closes/refreshes on a successful restore.

## Verification and limits

- Live DEV read-only checks: Next.js ETH_2692 Setup dynamic questions/uploads/grid and History; ETH_2692 Attachments tree/details; ETH_2683 Approver route with three stages and stakeholder status; ETH_2685 rework History. VBCS preview and checked-out `origin/development` source were inspected. No live Oracle mutation or approval was performed.
- Fixture Chromium: the 20 Ethics journeys had 19 passes and one stale Attachments rail assertion; the three affected/new journeys then passed after that assertion was aligned with VBCS. Unit tests: 985 passed before the History fix; the focused History integration suite then passed 17/17, including the new owned/foreign ID check. Typecheck passed. Lint passed with the existing TanStack Virtual warning. Isolated production build passed before and after the History fix.
- The user-supplied screenshots are the layout reference. Exact pixel parity on every Ethics page, approval write acceptance, and DEV file storage behavior are not established by these read-only checks.
