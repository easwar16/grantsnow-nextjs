# Claims Unit Activities, slice 4: approvals (fund, amendment, activity, roster)

- **Date / author / agent:** 2026-11-10 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `4542021` (after `2026-11-10-titiksh-claims-requirements.md`)
- **Why:** checklist Next up (Claims slice 4). Legacy `claims-unit-activities-start-page` (`origin/development`): the
  fund bar's Submit for Approval / Withdraw (`buttonAction44` / `45`), the approvals list below the Activities List,
  the amendment's own Submit / Withdraw and list, the activity's `activity-approvals` sub-tab, the roster menu's
  Approvals (`approvalsDialog`); chains `submitForApproval`, `submitApprovalAction`, `generateApprovalStages`,
  `switchApprovalSubmission`, `fetchApprovalStages`, `fetchApprovalHistory`, `tabSelected`, `menuOptionAction`.

## Problem, legacy rule, shared pieces (guide §6)

- **Problem:** Claims had no approvals: a planned fund or amendment could not be submitted, and approvers could not
  act from the record.
- **Legacy:** Claims draws its own approvals list on the page, but calls the same operations as the shared approval
  fragment (stages, stage users, generate, post_approval, history, approvers). Its Submit generates the route and posts
  in one step, and posts Withdrawn if the post fails. Its labels are its own (`submit-approval`, `withdraw-approval`).
- **Shared pieces:** the shared `ApprovalWorkflow` and `workflowRead` / `workflowWrite`, with a Claims
  `ApprovalHost` (`unitApprovalHost`), not a Claims copy (guide §8: one workflow for every module).

## What changed

- **Shared approval host, extended once, backwards compatible:**
  - `ApprovalHost.submitGenerates`: Submit needs no route yet and offers no separate Generate. On Submit it generates,
    posts, and on a refusal posts Withdrawn and passes the refusal on (legacy submitApprovalAction).
  - `ApprovalHost.keys`: the host's own `button-labels` keys for Submit and Withdraw (Withdraw's also gates it).
  - `ApprovalWorkflow.onChanged`: called after a write, for a host read in the browser (the router refresh only serves
    server pages).
  - Other hosts are unchanged: both fields are optional.
- **Claims host** `record/approvals.ts`, served at `api/claims/units/[id]/workflow/[doc]`:
  - `fund-<id>` (CLAIM_FUNDS): Submit when the plan is complete. That means DRFT or REWORK, at least one activity,
    an Unapplied Balance of 0, and a status that allows a user edit (legacy's gate). Withdraw in AIA, behind RB
    `withdraw-approval`. Approvers can be changed in DRFT, REWORK and AIA.
  - `amendment-<fund>-<id>` (CLAIM_FUNDS_AMENDMENT): the same rules, on the amendment's lines and ADJ_ statuses.
  - `activity-<fund>-<activity>-<version>` (CLAIM_ACTIVITY) and `roster-<id>` (CLAIM_ROSTER): view and act only
    (legacy has no Submit there).
  - Every document is checked as this application's: its fund, amendment, activity version or roster member.
- **Browser:** `record/approval-section.tsx` mounts the shared workflow in four places:
  - below the Activities List (with legacy's `submit-needs-zero-unapplied` hint);
  - under the chosen amendment;
  - as the activity panel's Approvals section (when the version is IA or AIA, legacy `li#activity-approvals`);
  - in the roster row's Approvals dialog (75vw, RB `dialog-titles.approval-details`).
- `activitiesView` reads the fund's activities beside its summary, for the hint.

## Rights (recorded difference)

Legacy gates Submit, Withdraw, stage delete and approver changes by status alone. Here they also need the Activities
page's edit right (`claims-unit-activities`), so a user without it sees the route but no actions (fail closed, AGENTS.md).

## Live DEV evidence (2026-11-10)

- Reads: app 384 fund 264 route (2 stages, Notified / Approved), activity 700 v920 route and history, roster 261
  route; a fund, member or document that is not the application's is refused.
- App 1164 fund 1065: added a Non Position activity of £18,500 (Unapplied → £0). Submit then appeared and generate +
  post ran. The backend refused with `FPCG014 : Total activity amount cannot be less than or equal to 0` (the existing
  Position activity 1 is £0). The rollback posted Withdrawn: one history row, no route left, and the fund moved to
  "Sent for Rework", as legacy's Withdrawn does. Left on DEV: the £18,500 activity and the fund in REWORK. Activity 1
  was not touched.

## Not in this slice

- Stage attachments (legacy add / view attachments on a stage) and peer-review user remarks: not built, so not
  rendered.
- After a failed write the shared workflow does not refresh its host, so the fund's status shows its old value until
  the next read (legacy re-reads after every attempt).

## Replaces / overrides

Nothing removed. The shared host and component gain optional fields (above).

## Rules touched

None.

## Checks

Typecheck clean; new tests: Claims host (5) and shared workflow `submitGenerates` (2), 19/19 in
`approval-workflow.test.ts`. Full checks and e2e (new approval assertions) run when Claims is complete, as agreed.
