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
- **Rebase onto `d972979` (Ayush, "03-11-26 Docker files"), 2026-11-03:** main now carries `Dockerfile`, `.dockerignore`
  and `.gitignore` (`.claude`). Kept main's versions: a separate dependency stage, `NODE_ENV` in the build, the
  selector `.env` removed from the runtime image, and `.github` / `AGENTS.md` / `CLAUDE.md` kept out of the context.
  Restored two lines main's version lacked: the build runs with `FIXTURE_MODE=false DEV_BROWSER_SESSION=false`, and
  the image's `HEALTHCHECK` on `/api/health`.
- **Secrets helper (owner, 2026-11-03), after Ayush's start-up failures:** a container started without its secrets
  file stopped on `Missing configuration: SESSION_PASSWORD`. `scripts/docker.sh secrets [env]` now creates
  `.env.<env>.secrets` from the template with a random 48-character `SESSION_PASSWORD` (mode 600; it never overwrites)
  and prints only the names of the keys still empty. `deploy` refuses a missing file or a password under 32 characters.
  Tested in a scratch folder with a fake template; the owner then ran build and deploy on this machine (Docker
  started for the session only: `sudo systemctl start docker`, now in the README). The second failure (`IDCS tenant compatibility has not been
confirmed`) needs the IDCS client registration; not changed.
- **`.gitignore` `*.secrets` (owner, 2026-11-03):** the secrets files were already ignored through `.env*`; an explicit
  `*.secrets` rule covers one under any name. `.dockerignore` unchanged: it lets in only `.env` and the five settings
  files, which `npm run build` needs to bake `.env.<env>` in as `.env.production`.
- **One file per environment (owner, 2026-11-04):** `.env.<env>.secrets` and `.env.secrets.example` are gone.
  Secrets live in `.env.<env>` beside the settings. `prepare-standalone.mjs` bakes that file without its secret keys
  and fails the build if one would remain; `deploy` passes the file with `--env-file`; `secrets [env]` adds the
  missing keys and a `SESSION_PASSWORD` to it. Tested on fake files: secrets and ORDS client ids stripped, settings
  kept, the generated password at least 32 characters, empty keys named.
- **Secrets files removed (owner, 2026-11-04):** `.env.dev.secrets` was deleted after checking that `.env.dev`
  holds every secret it had (the OIC user and password were empty in both). The `*.secrets` rules in `.gitignore`
  and `.dockerignore` went with it; `.env*` already keeps every environment file out of git.
