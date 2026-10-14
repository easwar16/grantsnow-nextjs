# First increment checklist

Scope: Home, read-only Proposal listing, IDCS/GrantsNow session foundation. Final destination is the current Superset workspace, per the user’s correction; source lives directly in this repository. Legacy baseline inspected read-only: `6f1c81f0cc70d11b1ad0f1881e3a2f5db0c3675e`, compared with supplied inventory baseline `3acfe9e272e2db076d92942ebbf86776ae583077`. Existing untracked legacy docs and browser evidence preserved.

- [x] Read vault migration/architecture context and supplied three artifacts.
- [x] Trace session/bootstrap/validate/extend/logout and business-error handling.
- [x] Trace Proposal fields, filter transform, paging and sort.
- [x] Trace Home attention/statistics operations and preference gates.
- [x] Establish OIDC library + protected server cookie + service authentication gate.
- [x] Complete shell, Home and listing.
- [x] Validate types/lint/tests/build/browser and record precise evidence.
- [x] Update existing vault note.

Assumptions requiring live proof: token-bound listing row scope; identity owner's username claim; service-account trust; actual login expiry timezone; configured Home read grant; independent connectivity and exact metadata. No credentials or tenant URL provided. Production readiness requires these checks; fixture success does not prove them.

API mapping is documented in `api-mapping.md` and machine-readable allowlist `src/server/api/operations.json`. No API endpoints are inferred from naming alone.
