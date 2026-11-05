# Docker images and environments (no deployment performed)

Each image is built for one environment and named `grantsnow-<env>:<version>` (e.g. `grantsnow-uat:0.1.0`). Hosting,
TLS, secrets and multi-instance rules in [azure-deployment.md](azure-deployment.md) apply unchanged.

## Picking the environment

`.env` selects it:

```sh
# .env
GRANTSNOW_ENV=uat
```

`npm run build`, and so `docker build`, copies `.env.<env>` into the build output as `.env.production`, which the
server loads at start-up. `GRANTSNOW_ENV` in the shell, `--build-arg GRANTSNOW_ENV=…` or the script's `[env]` argument
override `.env`. An unknown name or a missing settings file fails the build; with no selector nothing is copied and
every setting comes from the runtime environment.

| Env   | File (settings and secrets) | `APP_ENV`   |
| ----- | --------------------------- | ----------- |
| dev   | `.env.dev`                  | development |
| demo  | `.env.demo`                 | staging     |
| uat   | `.env.uat`                  | staging     |
| stage | `.env.stage`                | staging     |
| prod  | `.env.prod`                 | production  |

- All `.env*` files, `.env.example` included, are gitignored and shared privately. `.dockerignore` lets only `.env` and
  the five environment files into the build; `.env.local` never reaches it.
- **One file per environment** (owner, 2026-11-04) holds the settings and the secrets. The build bakes it into the
  image as `.env.production` **without** the secrets: any key ending in `SECRET`, `PASSWORD`, `BEARER`, `_USER` or
  `USERNAME`, and the ORDS client ids. It refuses to build if one would remain (`scripts/prepare-standalone.mjs`), so
  the image pushed to the registry carries none. `deploy` passes the whole file to the container (`--env-file`), and
  that is how the secrets arrive.
- **Settings**: the backend values The backend values (ORDS base/apps roots, OIC, APEX
  Reports/Administration, customer support, chatbot) are the live VBCS app's per deployment profile, from
  `origin/development` `services/catalog.json`, `services/base/openapi3.json` and `shell-page.js` `getApexURL` /
  `getSupportURL` (KB: GrantsNow-Deployment). When a live profile changes, change the file and build a new version.
- **Secrets**: `SESSION_PASSWORD` (different per environment), `IDCS_CLIENT_SECRET`, the two ORDS clients
  (`ORDS_BASE_CLIENT_ID` / `_SECRET`, `ORDS_APPS_CLIENT_ID` / `_SECRET`) and the OIC user. `scripts/docker.sh secrets
<env>` adds any missing key to `.env.<env>`, generates a `SESSION_PASSWORD` if it has none, makes the file
  owner-only and names the keys still empty. On Azure, the Container App's secrets and environment variables supply
  them instead. A variable set on the container overrides the built-in file.
- **Still to fill per environment:** `APP_ORIGIN` (HTTPS; register `APP_ORIGIN/api/auth/callback` and the logout return
  `APP_ORIGIN/login` on the IDCS client), the IDCS client settings (`IDCS_ISSUER=https://identity.oraclecloud.com/`, see `.env.example`), `ORDS_AUTH_MODE=oauth` with the four `ORDS_*_CLIENT_*` secrets, and the approvals
  `IDCS_COMPATIBILITY_CONFIRMED` / `ORDS_TRUST_CONFIRMED`. Until then start-up validation (`src/instrumentation.ts`)
  refuses to run and the health check fails.
- `APP_ENV=development` only adds the Oracle failure trace to the logs; the built server refuses fixtures and the
  paste-token login everywhere. `WRITES_ENABLED` is `false` everywhere until the owner turns saves on.

## Versions

The version is `package.json`'s; the image also carries labels for its environment, version, commit and build time
(`docker inspect`). Each environment builds a version once: `build` refuses an existing image, so a new build needs
`npm version patch|minor|major` (or `docker rmi` of the old one). Roll back by deploying the previous version.

## Commands

```sh
scripts/docker.sh help                      # every command with what it does
scripts/docker.sh build [env]               # build grantsnow-<env>:<version>
scripts/docker.sh secrets [env]             # add the secret keys to .env.<env>, a SESSION_PASSWORD if missing
scripts/docker.sh deploy [env] [version]    # run it as container grantsnow-<env> with .env.<env> (its secrets)
scripts/docker.sh push [env] [version]      # tag for gncontaineregistry.azurecr.io and push (az acr login first; REGISTRY overrides)
scripts/docker.sh remove [env] [version]    # delete that version from the Azure registry (az asks to confirm)
scripts/docker.sh rmi [env] [version]       # delete the local image (and its registry tag) so build can redo it
scripts/docker.sh azure-secrets [env]       # store .env.<env>'s secrets as Container App secrets (az login first)
scripts/docker.sh release [env] [version]   # point the Container App at that pushed version
scripts/docker.sh tag|status|logs|stop [env]
```

`[env]` defaults to `.env`'s. `deploy` refuses a missing `.env.<env>` or a `SESSION_PASSWORD` under 32 characters,
maps `PORT` (default 3000), restarts the container unless stopped, and prints
the last log lines if `/api/health` is not ok within 30s. The script uses `sudo docker` when the shell has no Docker
socket access. Without the script:

```sh
docker build --build-arg GRANTSNOW_ENV=uat -t grantsnow-uat:0.1.0 .
docker run -d --name grantsnow-uat -p 3000:3000 --env-file .env.uat grantsnow-uat:0.1.0
```

## The image

`npm ci` and `npm run build` (fixtures and paste-token off) on `node:26-alpine`. The run stage holds only
`.next/standalone` (with `public/`, `.next/static/` and the environment's `.env.production`), runs as the non-root
`node` user with `NODE_ENV=production`, and its `HEALTHCHECK` calls `/api/health` (500 while configuration is invalid;
200 does not prove Oracle or IDCS connectivity).

## Open

- **ORDS service authentication.** The live app calls the `base` service with OAuth client credentials
  (`<base>/oauth/token`); this app supports only `basic` or a static `bearer`. A deployed environment needs an approved
  mechanism (see authentication.md) first.
- Live-app quirks carried as they are: Reports opens APEX home outside dev/demo; customer support for demo and stage
  falls through to the dev host's UAT ticketing workspace; the chatbot is plain HTTP on one IP for uat/stage/prod.
