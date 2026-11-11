# Proposal linked pages and shared panels — 2026-11-11

## Source and preview evidence

- The user's signed-in P_6455 comparisons show VBCS New Duediligence Application, New Contract, Add Delegation and folder add controls, with lower empty states and a bordered Contracts no-data row. The prior Next.js pages used a generic Due Diligence label and immediate empty state, omitted New Contract and delegation actions, and placed a storage warning before the attachment tree.
- `origin/development` Proposal Due Diligence and Contracts pages use the configured button labels and inbox-add icon. Their source disabled expressions check `proposals-contracts.edit` for both actions. The live buttons were enabled. The Next.js pages use their own scoped page edit rights and the corresponding module create grant.
- The shared VBCS Delegations fragment shows Add, avatar, dates, Edit Access and Delete. The Next.js Proposal host had hardcoded both write rights false. The shared attachment fragment shows folder add controls and an initially blank detail pane.

## Implementation

- Due Diligence uses the configured create label/icon and the shared linked-page empty spacing. The existing parent-scoped create and link behavior remains.
- Proposal Contracts shows its configured New Contract action and a bordered empty row. The link carries the parent identity; the New Contract route validates fresh Proposal Contracts edit access and returns to that page. Contract create itself remains an existing disabled form.
- The shared Attachments panel moves its disconnected-storage status below the preview, shows disabled add controls where record edit is allowed, and retains the server storage gate for preview/upload/delete. The Proposal attachment host now derives edit access from fresh record page rights, Draft status and lock state.
- The shared Delegations component renders a disclosure and avatar beside the existing person/actions. The Proposal host now supplies fresh edit/delete rights only for an unlocked Draft page, and the shared server action path continues to reauthorize each mutation.

## Checks and remaining limits

- Signed-in local DEV P_6455 read-only visual inspection confirmed the changed actions and layouts on all four tabs. No live Oracle mutation or upload was run.
- Focused typecheck, lint, `git diff --check`, and one fixture Chromium journey passed. The journey checked authorized create links and delegation Add plus read-only Proposal denial for Contracts/Delegation.
- The Contract New page's Create button remains disabled in the pre-existing implementation. This linked page is visually closer but Contract creation is incomplete. Disconnected OIC storage prevents attachment opening, upload and delete acceptance. No live Delegation write/read acceptance was run.
