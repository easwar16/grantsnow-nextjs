# EOI: insertRequest as a POST upsert with the attributes (legacy 9284), and a live Submit

- **Date / author / agent:** 2026-11-11 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on 4542021
- **Why:** creating an application failed live with "Oracle is unavailable" (502): `getDynamicFormsInsertRequest`
  answered **HTTP 405**. Legacy 9284 (`020a99a3a` + `04a128310`, 2026-10-26) turned it into
  `POST apps/postDynamicFormsInsertRequest` with a JSON body; the GET is gone from the contract. Legacy also:
  - sends `{request_id ?? null, ref_object_id, ref_object_type: 'OPPORTUNITIES', request_type: 'OPPORTUNITIES-EOI',
...attribute_N}`, on Create and on **every Save** of a saved application (an upsert), before the form's answers
    (`saveButtonActionChain`);
  - saves the attributes that way (before 9284 nothing posted them, which is why the rebuild showed them read-only);
  - mounts the attributes panel with `objectType="OPPORTUNITIES-EOI"` (the typo `OPPORTUNIES-EOI` fixed).
- **What changed:**
  - `operations.json`: `postDynamicFormsInsertRequest` (POST, write) replaces the GET; the catalogue script and test
    no longer list it as a GET that writes.
  - `eoi.insertRequest` posts the body above. `createEoiApplication` takes the panel's `attributes`; new
    `saveEoiApplication` (route `POST /api/opportunities/eoi/[id]/application`) runs the upsert under the form's edit
    rules (`authorizeForm(…, "edit")`: page edit right, draft, open lock) with the request's own opportunity.
  - Application tab: the attributes panel is editable while the application is, starts from the request's
    `attribute_N` values (`eoiRecordContext.attributes`), and its values go to Create and to Save (upsert first).
  - Attributes host type `OPPORTUNITIES-EOI`.
- **Shared pieces used or extended:** `ObjectAttributes` (`initial`, `values()`), `authorizeForm`; new
  `src/server/record/attributes/values.ts` (`recordAttributeValues`, `attributeInput`), now also used by the award
  header (its local copies removed).
- **Replaces / overrides:** the read-only attributes decision on the EOI Application tab (its comment said legacy had no
  attributes write; legacy has one since 9284).
- **Rules touched:** none.
- **Checks:** unit and integration tests (create body, Save upsert with its refusals, the attributes host type);
  Typecheck clean; lint 0 errors (the existing `react-hooks/incompatible-library` warning); `npm test` 109 files / 991 tests; isolated build OK; `npm run test:e2e` 48 passed (2026-11-11).
- **Live DEV (2026-11-11, opportunity 7165673 "SD Test Opportunity"):**
  - EOI 4074 (AOI_522) created with Attribute 1; the attribute read back. Save on it updated Attribute 1.
  - EOI 4076 (AOI_524) created, Application finalized, Workflow tab opened, route generated (one stage),
    **Submit for Approval sent: status Awaiting Internal Approval**, history "Submitted" with the comment, Approve /
    Reject / Rework and Withdraw offered. Left as is (test data).
  - EOI 4075 (AOI_523) used to isolate the defect below.
- **Backend defect found (not the rebuild):** a second save of a saved application's answers
  (`POST /dynamicForms/dynFormResponse`) leaves **no answers** (`GET` returns `[]`). Reproduced on 4074 and 4075 in the
  rebuild, with and without the upsert, and in **VBCS 621** itself on 4075 (same body as legacy's, captured). The
  first save after Create keeps them. For the backend owner.
- **Open:** Cancel Edit does not reset edited attribute values (the panel keeps its own state); after Finalize, one
  reload did not show the Workflow tab yet (it showed a minute later), not reproduced.
