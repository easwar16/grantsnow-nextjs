# Ethics Responses visual parity — 2026-11-12

The owner's side-by-side screenshot is the **Responses** tab for ETH_2683 in Approver access. The Approvals tab in Next.js uses the shared `ApprovalWorkflow` component (`src/features/record/approvals/approval-workflow.tsx`); it was not rebuilt as a separate Ethics workflow.

## Changes

- Moved the response version selector into the Ethics record header's third column, matching the VBCS position. The selector keeps the version query parameter and direct-refresh behavior.
- Added an opt-in read-only presentation to the shared `DynamicForm` host, used by Ethics Setup and Responses. It displays blank read-only dates as blank text, and uploaded documents as large gray file cards with the file name, field description, and disabled actions when storage is unavailable. Other dynamic form hosts retain their existing presentation and edit controls.
- Made the Ethics participant rail use the gray VBCS panel and selected-participant highlight.
- Kept the Approvals page on the shared workflow and corrected the shared Pending-stage neutral background and badge to match the VBCS approval fragment.

## Verification and limit

- The signed-in local DEV ETH_2683 Approver Responses view was inspected read-only against the supplied VBCS screenshot. The header version, uploaded file cards, date spacing, and rail now have the same structure. No Oracle mutation or approval was performed.
- The full fixture Ethics Playwright suite passed (21/21), as did 79 focused dynamic-form unit/integration tests, targeted lint, TypeScript, and the isolated production build. The last change to the common Pending-stage color is CSS-only and did not change workflow behavior.
- VBCS shows Print for ETH_2683 while Next.js hides it under the current `ethics-print-button` read-access gate. A proposed change to allow any present role entry was rejected by automatic approval review because it could expose sensitive reports; the existing fail-closed gate remains. The source and live role contract must be reconciled before changing it.
- The owner's VBCS screenshot does not show the `New added field testing` dynamic field that appears in the local DEV response after `Data Storage and Safekeeping`. The current read payload drives this form, so the field was not hidden by its display label without evidence of a VBCS visibility rule or a matched current preview read. Exact field-level visual parity for this record remains open.
