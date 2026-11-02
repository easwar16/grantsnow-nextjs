# Docker images per environment, env-file selection and versioned names

- **Date / author / agent:** 2026-11-02 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on a5a99b6
- **Why:** owner request: Docker deployment on Node 26 for five environments (dev, demo, uat, stage, prod), one env file
  per environment chosen by a single `.env`, and images named `grantsnow-<env>:<version>`.
- **What changed:**
  - `Dockerfile`: two stages on `node:26-alpine`; `ARG GRANTSNOW_ENV`; runs `.next/standalone` as the non-root `node`
    user with a `HEALTHCHECK` on `/api/health`.
  - `.dockerignore`: keeps git, sessions, `node_modules`, build/test output and every `.env*` out of the context except
    `.env` and the five settings files.
  - `scripts/prepare-standalone.mjs` (run by `npm run build`): copies `.env.<GRANTSNOW_ENV>` into the standalone output
    as `.env.production`, which the Next server loads at start-up; the environment comes from the shell or build arg,
    else `.env`. Unknown names and missing files fail the build; no selector copies nothing (unchanged behaviour).
  - Gitignored env files: `.env` (selector), `.env.dev|demo|uat|stage|prod` (the live VBCS app's per-profile ORDS, OIC,
    APEX, support and chatbot URLs), `.env.secrets.example` (template for `.env.<env>.secrets`).
  - `scripts/docker.sh`: `build [env]`, `deploy [env] [version]` (secrets only at run time, waits for health),
    `tag|status|logs|stop [env]`; `[env]` defaults to `.env`'s.
  - `docs/docker-deployment.md`. `package.json`/lockfile `engines` `>=24 <25` → `>=24 <27`.
  - `.gitignore`: every `.env*` file is ignored (owner); the `!.env.example` exception is removed and `.env.example` is
    untracked (`git rm --cached`; the file stays on disk). README's setup step `cp .env.example .env.local` now relies
    on the file being shared privately.
  - Clean-up: `.nvmrc` removed (nothing read it; README points to `engines`); `npm run clean` output and
    `.catalogue-preview` cleared; superseded `scripts/docker-dev.sh`, `.env.docker`, `.env.target` and earlier test images
    removed.
- **Shared pieces used or extended:** `output: "standalone"`, `prepare-standalone.mjs`, `/api/health`, start-up
  validation in `src/instrumentation.ts`, Next's own `.env.production` loading. No application code changed.
- **Replaces / overrides:** none of the framework. Within this change, the runtime-only configuration and the
  `0.1.0-<commit>` / `grantsnow-next:<version>` tags were replaced at the owner's request.
- **Rules touched:** Node 26 (owner); AGENTS.md and docs/architecture.md still say Node 24. Deployments sign in through
  IDCS and the ORDS service account (owner's choice); the paste-token guard is unchanged. No new dependency.
- **Checks:**
  - `docker build` passes (Docker 29.9.2; Node 26.13.0, user `node`, 440 MB). `scripts/docker.sh build uat` logged
    "configured for uat"; a plain `docker build` with `.env` = dev and no build arg carried `.env.dev`; each image's
    `.env.production` is byte-identical to its settings file and no image env file holds a secret value.
  - `grantsnow-uat:0.1.0` deployed with only `.env.uat.secrets` (placeholders): healthy, `APP_ENV=staging`, UAT ORDS
    and chatbot URLs loaded. Earlier containers: missing `ORDS_AUTH_MODE` → start-up error, health 500, Docker
    `unhealthy`; complete → health 200, `/home` 307 to `APP_ORIGIN/login`, `/login`, `public/`, `/_next/static` 200.
  - Script: `tag` → `grantsnow-dev:0.1.0` (from `.env`), `tag uat` → `grantsnow-uat:0.1.0`; a second `build uat`, an
    unknown command, a missing image or secrets file each exit 1 with a message. `prepare-standalone.mjs`: no `.env` →
    nothing copied; `qa` or a missing `.env.demo` → error; shell `GRANTSNOW_ENV=prod` overrides `.env`.
  - `bash -n` passes (shellcheck not installed). Typecheck, lint, unit and e2e not run (no application source change).
    No live IDCS sign-in or ORDS call.
- **Open:** ORDS service auth (live app uses OAuth client credentials; this app has basic/static bearer only);
  `APP_ORIGIN`, IDCS clients and approvals per environment; which environments enable writes; registry and hosting.
