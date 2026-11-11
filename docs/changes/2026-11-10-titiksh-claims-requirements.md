# Claims Unit Activities, slice 3b: Fund Summary requirements (surveys)

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-fund-panels.md`)
- **Why:** checklist Next up (Claims slice 3b). Legacy `claims-unit-activities-start-page` (`origin/development`):
  the second accordion of the Fund Summary (`activitySummary.requirements`, one `REQ_<req_id>` collapsible each), chains
  `loadRequirements`, `expandRequirement`, `submitSurvey`, `loadAuditTrail` (`DYN`), page function
  `getRequirementsLookup`; the dynamic-form fragment's `loadDynForm` / `submitDynForm` / `preparePayload`.

## What changed

- **Fund Summary:** below the table, one collapsed panel per requirement configured for the fund (the fund summary's
  `requirements`), headed by RB `header-labels.<req_type_code lowercased>`. Each has the person responsible (name and
  email, required; legacy's `person-reponsible-*` keys), the shared `DynamicForm` (object type CLAIMS, slot = the
  requirement's `reference_module`, object = its `app_requirement_id`, files under the application), the RB-gated Audit
  Trail (on a saved requirement) and Submit. Editable and Submit only while the fund's status allows a user edit
  (`CLAIM_FUNDS`, `CLAIM_FUNDS_AMENDMENT`); otherwise read-only values.
- **Submit** (legacy submitSurvey): the requirement first (`putRequirement` with the row as read plus the person and
  fund; `postRequirement` `{req_type_code, person_responsible_name, person_responsible_email, app_fund_id}` when none),
  then the answers against its id, then legacy's "Response saved".
- **Server** `record/requirements.ts`: `requirementsView`, `saveRequirement` (refuses a form not configured for the
  fund, an empty field, a closed fund), `requirementOf` (the audit and form checks) and `unitFormAccess`.
- **Shared form host:** the Claims form check moved out of `server/record/dynamic-form/access.ts` into the Claims
  module (`unitFormAccess`: Assurance as before, plus the surveys, each checked against this application's
  requirement of that module and, for a save, its fund's status). The shared file now maps CLAIMS slots to a page and
  calls the module, and no longer imports four Claims files (the host rule, guide §4).
- **Audit:** `unitPanelHost` serves a survey's trail (page = the module lowercased, object type = the module, object =
  the requirement, legacy loadAuditTrail `DYN`), after checking the requirement is the application's.
- **API layer:** `claims.requirements` takes an optional type and `app-fund-id` (legacy loadRequirements sends the
  fund, Assurance the type). Route view `requirements`, POST `save-requirement`.

## Defect fixed in the shared form (owner to review)

`toPayload` drops forms with nothing to answer (`9955087`, tested). For a form with no sections it then sent `[]`.
DEV's `postDynamicFormsDynFormResponse` saves (response 12499) but replies with broken JSON
(`[{ "form_id": ,"response_id": 12499, "sections": []}]`), so the save failed with "Oracle returned an invalid
response." Legacy `preparePayload` always names each form (`{form_id, sections: []}`). Fix: when the forms have no sections at all,
the first form is sent with no sections; every other case is unchanged (all sections switched off still sends `[]`) (the existing test stays, one test added).
Reproduced and verified live on app 1164 (502 before, "Response saved" after). Recorded in progress.md.

## Live DEV evidence (2026-11-10)

- App 384 fund 264 (Original Final Approved): "Parent Policy" (COMPLIANCE-SURVEY, form 103, requirement 343), read-only
  person responsible, Audit Trail shown. DEV's form 103 has no sections (dynForms with legacy's headers), so the form
  area shows "No data to display.", as legacy would.
- App 1164 fund 1065 (Original Pending): requirement 805 submitted unchanged → putRequirement, answers saved, "Response
  saved". Empty fields are refused (400, legacy's required message).

## Not in this slice

One-open-at-a-time (legacy accordion with `expandedRequirementId`, which existed because the fragment had one
submit trigger): each panel here has its own form, so several may be open.

## Shared pieces used

`Collapsible`, `DynamicForm`, `ReadonlyField`, `InsideField`, `useRecordAudit`, `ListSkeleton`, `State`, `useToast`.

## Replaces / overrides

The `toPayload` change above (narrow; for the owner's review).

## Rules touched

None.

## Checks

Typecheck clean; requirement (4), engine (27, one new), contracts access and award slot tests pass. Full checks and
e2e (new Requirements step) run when Claims is complete, as agreed.
