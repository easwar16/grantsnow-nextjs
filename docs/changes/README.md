# Change records

Every change to this repository gets a short record here, whether a person or a coding agent (Codex, Claude Code)
made it. The records answer, before anyone touches the code again, what changed, why, and what it replaced, so two
people's work can be compared and the better one kept, instead of being silently overwritten.

## Rules

- One file per change set: `docs/changes/YYYY-MM-DD-<author>-<short-slug>.md` (author: `titiksh`, `easwar`, …).
  One file each avoids merge conflicts between branches.
- Write it in the same change, before you finish; update it if the change grows.
- Before you edit a file, rebase, or resolve a conflict, read the records that touch the same files or modules
  (`grep -l <path-or-module> docs/changes/*.md`). If your change would undo or replace something a record explains,
  do not proceed on your own: state the trade-off in your record under **Replaces** and leave the decision to the
  owner.
- Keep it factual and short. Long reasoning belongs in `docs/progress.md` or `docs/grantsnow-foundations.md`.

## Template

```markdown
# <one-line title>

- **Date / author / agent:** 2026-10-26 / easwar / Codex (or "by hand")
- **Branch / base commit:** <branch> on <short sha>
- **Why:** the defect, legacy behaviour (file in VBCS `origin/development`) or owner request that requires it.
- **What changed:** behaviour, not a file dump; then the main files.
- **Shared pieces used or extended:** components, record hosts, API functions, libraries.
- **Replaces / overrides:** earlier code or decisions this changes, with the record or commit it came from, and why
  the new way is better. "None" if none.
- **Rules touched:** any framework rule or foundations decision affected, and why. "None" if none.
- **Checks:** typecheck, lint, tests, build, e2e — results as they are; live DEV checks separately from fixtures.
- **Open:** what is left, or needs the owner's decision.
```
