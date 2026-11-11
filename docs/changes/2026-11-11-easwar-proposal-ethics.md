# Proposal Ethics linked page — 2026-11-11

## Verified behavior

- The supplied signed-in VBCS P_6455 screenshot shows a teal **New Ethics** button and a lower, left-aligned “No data to display.” message. Next.js previously omitted the action and placed the empty text directly below the record header.
- In `origin/development`, `proposals-ethics-start-page.html` opens Ethics General Overview with a `PROPOSAL` reference. Its button disabled expression tests `proposals-contracts.edit`, despite being on the Ethics page. The observed VBCS button was enabled; the Next.js server uses the Proposal Ethics page edit grant plus the Ethics creation grant. The source/preview gate discrepancy remains recorded rather than assumed to be intentional.
- The VBCS create chain sends Proposal `obj_ref_id`, `obj_ref_type`, `enabled_by`, stakeholders and `reference_objects` in its submit payload.

## Implementation

- Proposal Ethics renders the configured New Ethics action and the observed empty-state layout. Linked Ethics rows navigate to their Ethics record with the available access type.
- The New Ethics route validates a parent Proposal query, fresh-reads the scoped Proposal Ethics permission, and passes the parent into the existing Ethics form. The Ethics create action validates the parent again and sends explicit Proposal reference fields to Oracle for both draft and submit. An unscoped Ethics creation remains available through its existing route.
- The Oracle example for `getDynamicFormsGetApplicationApprover` contains a sentinel “Not Applicable” row with `person_id=-1` and no Org Unit. The supervisor parser now ignores that row, while retaining valid scoped people. Cancel returns to the parent Proposal Ethics page.
- Fixture roles grant Proposal Ethics editing to Outline Proposal 1000 and read-only access to 1001 for the negative case.

## Verification and limits

- Typecheck, focused lint, two unit files/four tests, focused fixture Chromium creation-link journey, and `git diff --check` passed. The browser journey checked the visible action, scoped navigation, successful fixture creation payload, and a 403 for the read-only Proposal.
- After one transient “This page is unavailable” error, the signed-in local DEV P_6455 tab visibly showed New Ethics and the lower empty message at the VBCS positions. The linked form loaded with no supervisor parse error, and Cancel returned to Proposal Ethics. No live Oracle mutation was made, so persistence acceptance remains open.
- Populated Ethics cards and source role behavior across Proposal variants still need live comparison. This record does not claim complete Proposal Ethics parity.
