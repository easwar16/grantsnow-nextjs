# Account settings

Implemented in the current Next.js worktree using the existing VBCS shell, shell-configure-drawer fragment and action chains as references. No legacy files were changed.

## Implemented

- Manage profile: resource-filtered read-only full name, organization, position, date of birth and institutional/approver/system role descriptions from the validated Oracle identity. Identity is never editable.
- Preference tab: research areas, favourite funders and keywords, existing lookup suggestions, custom values and removable selections. Saves deduplicated CSV through `POST /shared/UserPreference`, with a server-held token header.
- Manage tab: Active/Out of Office, start/end date-times, status message and organization/proxy selection. `GET/POST /shared/PersonStatus`; server derives the current person and existing record/proxy IDs, checks authorized organizations and directory selections, requires complete OOO data, and clears proxies on Active. Dates retain their instants as timezone-bearing ISO strings.
- Preferences: end drawer, default/dark preset tiles and reset, individual and grouped Need Attention/Insights switches, Opportunities and Notifications. Saves through `POST /shared/dashboardPreferences`, preserving settings not edited in the form. These preferences never grant module access.
- Accessibility: seven original tile images; text/line-height/letter-spacing step controls, dyslexic font, enlarged cursor, highlighted links and contrast. Immediate preview, cancellation rollback and protected persistence through the dashboard preference operation. Saved accessibility is restored from server configuration on page loads. Typography sizes derive from the legacy CSS; this is a native React/CSS translation, not the original Oracle JET renderer.
- Protected `/api/account` GET/POST; same-origin writes, 32KiB streaming body limit, strict field schemas, no client identity override, no shared caching, separate HTTP/business errors and retry/loading states. Preferences/Accessibility do not require Profile directory/lookup requests to succeed.

## Verification and limits

Live DEV read verification: profile identity/roles, research preference lookup loading and Manage status tab were inspected in the existing authenticated Playwright session. Live Oracle writes were deliberately not executed during verification: status changes can reroute approvals. Fixtures exercise account saves, theme persistence and accessibility preview cancellation. Unit/integration checks include invalid inputs, hidden research access, unknown widget keys, HTTP-200 business errors, deduplication and returning Active with stale proxies.

Full source parity is not claimed. The source Digital Presence tab was hidden for the observed account and is not implemented here. Its checked-in write requires a token query parameter, contrary to this project's no-token-in-URL boundary; an approved header-based contract is required before implementing that write. Admin-curated custom theme catalog/policy editing is not implemented; only the two registered default/dark presets are offered. The DEV capture contains no independently verified IDCS email claim, so email is omitted rather than inferred. Proxy names not loaded by the selected directory currently retain their IDs in the table; directory pagination/search and exact OJET typography/layout parity remain refinements.

Local fixtures use guarded in-memory preference storage under `test-support`; this is not production session or preference storage. Real preferences remain in the existing Oracle backend. No new database or cloud service is added.
