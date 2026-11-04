# Agents may not read env files (Claude Code and Codex settings)

- **Date / author / agent:** 2026-11-03 / titiksh / Claude Code (settings shared by Ayush)
- **Branch / base commit:** Saurabh on d972979
- **Why:** keep secrets in `.env*` files away from coding agents.
- **What changed:**
  - `.claude/settings.json`: denies `Read` of `.env` and `.env.*` at the root and in any folder.
  - `.codex/config.toml`: the default permission profile `no-env` (workspace access, `on-request` approvals) denies
    `**/.env`, `**/.env.*`, `**/*.env`, `**/*.pem` and `**/*.key`.
  - `.dockerignore` and `.gitignore`: `.codex` is ignored, as `.claude` already is.
- **Note:** `.claude` and `.codex` are in `.gitignore` (owner), so both files stay on each machine; each developer
  adds them.
- **Shared pieces used or extended:** none.
- **Replaces / overrides:** none.
- **Rules touched:** none (AGENTS.md already forbids copying env credentials).
- **Checks:** both files parse (JSON, TOML).
