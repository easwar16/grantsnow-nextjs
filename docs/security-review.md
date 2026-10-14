# Local security/code review

Review covers this first increment's OIDC/session adapter, Oracle allowlist, authorization, input/response schemas, client DTOs, cookie/CSRF/cache behavior, fixture isolation and dependency lockfile. The Security Review skill was applied; no production action was performed. This is a local review, not external penetration testing or approval of live contracts.

Verified implementation boundaries:

- OIDC protocol/signature validation delegated to openid-client; fresh state/nonce/S256 and required ID token. Trust-confirmation gates require actual owner review before live mode.
- Username only from library-verified claims. Oracle service authorization mandatory and distinct DB token server-only. No NEXT_PUBLIC secrets, browser token stores, raw session/client payloads or token URLs/log statements.
- Encrypted cookie is HttpOnly, Secure under HTTPS, SameSite=Lax for OIDC callback, host-only; POST actions require exact Origin. Current strict-origin referrer policy keeps form Origin valid while omitting sensitive callback path/query from referrers.
- Module/read/organization checks are in data services/APIs. Missing grants fail closed. Browser query state can constrain but cannot substitute token identity or widen org scope.
- Oracle transport is allowlisted, timed out, no-store, redirect-rejecting; business/transport failures stay errors. Response schemas and DTOs remove extra/private/configured-hidden fields.
- Native React escaped text, no HTML insertion, controlled internal return routes, no arbitrary outbound browser URL or Oracle query expression.
- Fixture mode is explicit/labelled and refuses Node production or nondevelopment APP_ENV. Production startup validates settings rather than creating a fake session.
- Secret-bearing .env.local is ignored; test identities/tokens/keys are explicitly synthetic and isolated. Migration documents contain no copied catalogue credentials.
- Client search request abortion plus generation checks; synchronous single-flight renewal, no timer/retry loop. Renew/logout don't expose state-changing browser GETs.
- Real browser tests caught and corrected referrer policy + iron-session v9 destroyed-object reuse bugs; mocks alone did not validate those.

Remaining release requirements: actual IDCS metadata/claims/client authentication/end-session compatibility, independent Oracle service-account trust/network, backend token row scope/revocation/renewal concurrency, lookup completeness and response parity. Encrypted-cookie revocation/concurrent rotation limits are in authentication.md. CSP with a tested framework nonce policy, gateway rate limits, production operational monitoring and full accessibility/customer UAT need hosting/security review before deployment; no new cloud services are provisioned here.

Dependency audit: `npm audit --omit=dev` reports **0 vulnerabilities**. Full audit reports five high severity findings in the current Next ESLint tool chain (braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next), with no compatible patched release available in the inspected registry. npm's suggested forced downgrade to Next 14's lint configuration was not applied. ESLint 9 is deprecated but is the current compatible peer range of the shipped React/import/jsx-accessibility plugins; upgrading to ESLint 10 produced incompatible peer ranges. Keep this dev-only maintenance limitation visible and recheck when upstream plugins release compatible patched versions. No runtime dependency finding was reported. This is not a claim of a clean full audit.
