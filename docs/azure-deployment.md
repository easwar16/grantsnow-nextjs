# Azure preparation (no deployment performed)

Portable Node server; Next `output:'standalone'`. Linux App Service is a proposal, not a provisioned/confirmed resource. Use supported Node 24 LTS on the selected Azure service and verify its runtime availability with the hosting owner. No static export; auth/API handlers require a Node runtime.

## Build/start artifact

```sh
npm ci
npm run typecheck
npm run lint
npm test
# Production configuration, FIXTURE_MODE=false; no fixture fallback.
FIXTURE_MODE=false npm run build
# Prepared standalone server (set PORT and HOSTNAME in environment)
npm start
```

For standalone artifact, copy `.next/standalone/` contents into the deployment root, then copy `public/` as `public/` and `.next/static/` as `.next/static/`. This repository is rooted directly in its worktree; if packaging inside a monorepo later, verify standalone server path rather than assuming it. Start `node server.js` with `HOSTNAME=0.0.0.0` and the platform-provided `PORT`. `npm run build` copies static/public assets into the standalone output, and `npm start` launches that server. Set `HOSTNAME=0.0.0.0` and `PORT` through the hosting environment. Never ship local `.env.local`, test results or fixture development settings.

Use HTTPS-only application origin. Terminate TLS through the chosen Azure service, set exact APP_ORIGIN rather than trusting browser Host/X-Forwarded-Host, register matching IDCS callback and fixed logout return `/login`. Secure cookies are automatic from configured HTTPS origin. Authenticate health/readiness expectations: `/api/health` is public minimal status, startup validates configuration; it deliberately performs no Oracle write or secret disclosure. Health returning ok does not prove Oracle connectivity. Add integration availability monitoring under the hosting owner's policy later.

## Configuration/secrets

Configure every `.env.example` live category privately in App Service settings/approved secret references. Use Key Vault references if approved by hosting owner; no Key Vault/resource provisioning was performed. APP_ENV=production, FIXTURE_MODE=false, SESSION_PASSWORD shared across instances, actual IDCS settings and approved Oracle service auth/network route. Runtime fails clearly for missing/invalid production settings. Do not use NEXT_PUBLIC secrets. Static build uses no live credentials/data; final environment is read at startup/runtime.

## Multiple instances / caching

All instances use identical cookie protection key/version; coordinate rotation/sign-out expectations. Request-local cache only; no ISR/public data cache. Platform/CDN must not override private/no-store for authenticated HTML or `/api/*`; avoid shared auth responses. Sticky sessions are not a security substitute. Oracle validate checks revocation/access each request. Confirm extend token concurrency/nonrotation; if rotation needs locking/shared session authority, approve a supported shared store as separate work before multi-instance use. No in-memory map is treated as a session store.

Use secure network access to DEV then approved production service, least-privilege credential, HTTPS outbound, no URL credentials, explicit allowed Oracle roots. Configure stdout collection and diagnostics without headers/tokens/raw session payloads. Current adapter returns safe errors and has no credential logging. Product-level observability/correlation IDs and operational rollout remain future work.

Before Azure deployment, complete real IDCS/ORDS and permissions/contract acceptance in authentication.md, hosting choice, session concurrency review, app administrator configuration and production security/accessibility review. This task authorizes none of cloud provisioning/deployment/publishing or production writes.

Official references: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Azure Node App Service](https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs).
