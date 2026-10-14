# Foundation validation — historical first increment

**Current state:** see [VBCS parity progress](vbcs-parity-progress.md), updated 2026-10-14. The original table-first UI and read-only scope below are historical; the user approved the broader parity migration.

Date: 2026-10-13. Repository: `/Users/easwar/.superset/worktrees/gratsnow nextjs/faceted-rook-b1710e7e`. The user's explicit current-folder instruction supersedes the prompt's proposed Developer directory. All application files are directly in this worktree; no nested repository, commit, push, deployment or cloud provisioning.

## Implemented

Next.js 16.4 App Router/React 19.3/TypeScript 6, pinned npm lockfile and Node 24 LTS. Library-based generic IDCS OIDC code/PKCE/state/nonce/signature validation, separately protected GrantsNow session bootstrap/validate/renew/logout, encrypted HttpOnly cookie, exact-Origin POST protection, server-only allowlisted Oracle transport, fail-closed permissions and explicit development fixture isolation.

Responsive authenticated Home/Proposals shell, identity/organization/theme, nine configured attention adapters and eight statistics adapters with independent error/retry/loading/paging and scope/filter propagation. Proposal listing has real ORDS query mapping, stable Proposal/Outline identity, configured column visibility, date/value formatting, title/reference/status/organization-related/investigator/date/type/tags filters, sort/paging, URL back/forward/reload/reset, request cancellation/generation protection and safe errors. No unimplemented record actions or dead links.

## Validation evidence

- `npm ci`: passed using Node 24.13.0/npm, without peer-dependency bypass.
- `npm run typecheck`, `npm run lint`: passed.
- `npm test`: 59 tests across four unit/integration files passed. OIDC/Oracle integration boundaries are isolated mocks; cryptographic/live tenant compatibility is not proven by them.
- `npm run build`: passed; auth and personalized page/API routes are dynamic, no personal data prerendered. Build produces a portable standalone Node server and prepared static/public assets.
- Playwright: five full-Chromium journeys passed; independently, five installed-Chrome journeys passed. Covers login boundary/callback rejection/CSRF, Home filters/widget failure/retry/navigation, listing search/filter/reset/paging/back/reload, request failure/recovery/out-of-order results, mobile keyboard/cache/token isolation/renew/logout. Screenshots inspected for responsive layout. Development fixtures only.
- Default headless-shell run initially failed four journeys because Next development hot reload repeatedly reloaded login before any POST. Full Chromium channel resolves this; configured default is now `channel: chromium`. No authentication check was bypassed.
- Production fixture startup: explicitly rejects fixtures; protected server preparation fails and `/api/health` returns 500. Runtime integration checks and production build compilation are distinct.
- Prepared standalone `npm start` without live settings: clear missing `SESSION_PASSWORD` configuration error and health HTTP 500; no fake production fallback.
- `npm audit --omit=dev`: zero runtime findings. Full audit: five high dev-only Next ESLint transitive findings; see security-review.md for exact maintenance limitation.

Legacy inspected initially at `6f1c81f0cc70d11b1ad0f1881e3a2f5db0c3675e`. Another session advanced its HEAD to `329c2de1e5326d492570c2aad0db4808d1df81e6` during this task. A read-only diff confirmed no changes to the shell/Home/listing/API/app-flow/strings paths used here. Existing untracked `.playwright-mcp/` and `docs/` were preserved; this task made no legacy writes.

## Live integration blockers and deferrals

Real IDCS login, tenant metadata/client method/JWKS/logout, actual GrantsNow rows, service-account authorization, response shapes/expiry/renewal concurrency/row scope and customer resource configuration have **not been verified**. Exact owner inputs and live test procedure are in authentication.md; supply secrets privately in ignored settings. Trust gates remain disabled. Cookie replay/revocation and concurrent token rotation require backend confirmation before release.

Calendar event parity, chart-to-list reconciliation, dynamic insights/KPIs, custom theme catalogue/preferences, detail/edit/create/copy/delete/restore, approval actions and other module pages are deferred. See home-coverage.md and api-mapping.md for precise source coverage and limits. Azure hosting preparation is documentation/artifact only.

## Run here

`nvm use 24`, `npm ci`, `npm run dev`; open `http://127.0.0.1:3000` and select **Enter fixture workspace**. The ignored local environment is already prepared with a random session key and explicitly labelled synthetic data. For production-like compilation use `FIXTURE_MODE=false npm run build`; running the production server additionally requires complete verified live settings, HTTPS origin and `FIXTURE_MODE=false`.

## Current dashboard/loader increment — 2026-10-14

This section supersedes the historical first-increment coverage and live-data statements above. See dashboard-parity.md for exact limits; full VBCS/application parity is not signed off.

- Implemented VBCS sidebar artwork/reflow, source-colour/icons/tab strip, independent page/record/KPI/chart/table/detail skeletons and reduced-motion/accessibility status.
- All five configured dashboard tabs have working read views. Insights supports fifteen source preferences (fourteen visible source panels in the observed live account), source panel order, chart types/palette, multi-select date filters, complete chart result paging, expansion/data tables and independent failures. Dynamic Charts shares its engine and has protected dimension saving/report links.
- `npm test`: **152 passed** across sixteen unit/integration files.
- `npm run test:e2e`: **11 Chromium fixture journeys passed**, including all tabs, keyboard focus after filter navigation, chart rendering/expansion, multi-date filtering/reset, notification paging/recovery, chart dimension saving/CSRF and delayed skeletons. No real IDCS or live write is implied by these fixture checks.
- `npx tsc --noEmit`: passed. `npm run lint`: passed. `GRANTSNOW_BUILD_CHECK=true DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build`: passed with standalone/static/public assets in .next-check. Personalized pages/APIs remain dynamic.
- Production artifact scan found **zero matches for the captured DEV token**; capture remains ignored with mode 0600. Test scratch copies exclude credentials/captures. Runtime npm audit has no new chart-library finding; the existing five high dev-only Next ESLint transitive findings remain documented in security-review.md, and no major framework downgrade was applied.
- Live DEV KPI, Proposal/financial Insights and notifications were observed through the explicit captured browser session. Oracle Funding Opportunity Status returns **HTTP 555**, independently surfaced with retry. Award statistics completed after about **31 seconds**, so aggregations receive 60 seconds; no repeated automatic retry loop is introduced. The enabled Dynamic Chart returns an empty dataProvider; nonempty rendering and writes were verified only with fixtures. Funding Efficiency filters DASHBOARD_FEI before validating values/targets and does not invent a gauge from unrelated settings.
- Existing read-only legacy checkout remained at `b5bdcc31538ea292f2ca4ae4b09125914c2f90a5`. No legacy edits, commits/pushes, deployment or provisioning were performed.

Outstanding: exact OJET/pixel sign-off, chart/list drill reconciliation, full calendar parity, Home opportunity bookmark/share/notes/apply/convert workflows, full profile/preferences persistence and unbuilt Proposal/Opportunity mutation modules. Registration remains blocked on the VBCS Employee business-object contract/authorized server access. Cloud IDCS compatibility and release-grade row/access/concurrent-session verification remain administrator tasks.
