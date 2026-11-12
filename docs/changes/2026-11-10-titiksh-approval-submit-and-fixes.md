# Live approval Submit on award 1190, and the defects it found

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-redesign-live-pass.md`)
- **Why:** owner, 2026-11-10: run approval Submit (notifying DEV approvers is allowed: test data), then fix, then
  develop.

## Live run (DEV, award 1190, PI Titiksh)

- Finalized Award Header, Budget Periods, Projects, Dynamic Form 2; Risk Assessment (dynamic form 1) refused with
  FPX001 until its two mandatory answers were saved, then finalized. The Approvals tab then opened (legacy getTabs).
- Generate Approval Route: four stages created.
- Submit For Approval with a comment: sent; the backend refused with **FPA032** "Award amount does not match the
  budget period funder contribution total" (award £100,000, no budget periods). The dialog stayed open with the
  comment, as it should.
- To make the data agree, a project was needed: **Oracle answers HTTP 500 to creating a project on award 1190 in both
  the rebuild and VBCS 621** (621 toasts "undefined : undefined"). Backend defect; the award cannot be completed.
  Award 1176 (amount = funder total) opens no Approvals tab for this user (no read on its approvals page).
- Left on DEV (test data, not reverted): 1190's pages finalized except Projects (unlocked to add the project), its
  route generated, dynamic form 1 answered; 1176's Budget Periods, Projects and dynamic forms 1–2 finalized.

## Fixes

- **Escaped markup in backend messages:** FPX001's `preventive_action` arrives as escaped HTML
  (`&lt;p&gt;Kindly answer…&lt;br&gt;Text test…`) and was shown as such. `backendText` (the one place backend text is
  taken) now decodes it to the same words with one line per break; the toast's detail keeps line breaks. The owner
  rule (code : description + preventive action, verbatim) is kept: only the encoding changes. Live: award 1188
  shows "Kindly answer all mandatory questions for the form/Attribute:" then "Actual Award Date".
- **Add Project refused every new project** ("Please fill all the required fields"): the required check counted
  Project Number, which renders only for a saved project (legacy `oj-bind-if project_id`; JET validates rendered
  fields only). It now skips the number for a new project. Live: the dialog submits.
- **Summary grant columns (legacy grantColumn):** grant category, grant, payment and holding accounts after
  Grant/CFDA, each while its `table-headers` RB row is visible. DEV shows Grant and Payment Account Code (app 1065).
- **§4: EOI API** `opportunities/eoi/create` and `eoi/funders` moved to `eoi/actions/[action]` (create) and
  `eoi/choices?list=funders`. Live: the funder list loads.

## Shared pieces used or extended

`backendText` (Oracle connection), the toast, `DataTable`, the actions and choices dispatchers.

## Replaces / overrides

None of a record. The toast message change keeps the verbatim rule.

## Rules touched

None.

## Checks

Typecheck clean; lint 0 errors (the existing warning); 101 files / 942 tests (new: the escaped-markup case);
e2e with the next change.

## Open

- A successful approval Submit needs an award whose amount matches its budget periods and whose approvals page this
  user can read; or the backend fix for project creation on 1190.
