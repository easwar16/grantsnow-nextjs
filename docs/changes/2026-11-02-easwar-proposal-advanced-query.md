# Implement the Proposal listing Advanced Query drawer

- **Date / author / agent:** 2026-11-02 / easwar / Codex
- **Branch / base commit:** `codex/proposals-azure-integration-20261030` on `aec5020`
- **Why:** VBCS `origin/development` puts Advanced Query in the results toolbar and opens an end drawer with Attribute, Operator, Value, Add Condition, and editable condition rows. The Next.js toolbar opened a placeholder while the sort control remained at the bottom of the sidebar.
- **What changed:** The toolbar now opens a working VBCS-style condition drawer. Conditions are validated and serialized through the Proposal query schema, use the allowlisted `getProposalsListAdvanced` API operation, and combine with basic listing filters on the server. Available attributes come from the advanced view's first row, with custom labels from shared object attributes. Date Sort is positioned before the created-date fields in the sidebar as in the source. The listing's existing paging and state handling remain in use.
- **Shared pieces used or extended:** `Select`, `InsideField`, `DataTable`, `ActionDialog`, `useApi`, the Oracle API layer, and resource labels.
- **Replaces / overrides:** Replaces the nonfunctional Advanced Query placeholder documented in `2026-11-02-easwar-proposal-list-actions.md`. That record's disabled create controls remain outstanding.
- **Rules touched:** The new Oracle operation is added to the operation allowlist. Attributes are checked against the source-derived choices server-side; the client only receives display labels and allowed names.
- **Checks:** Typecheck passed; lint passed with one existing TanStack warning; 882 unit tests passed; isolated production build passed; fixture Playwright: 30 passed, 2 skipped, including the Advanced Query add-condition journey. The existing Next.js preview on port 3000 responds. No live DEV mutation was used.
- **Open:** Live DEV comparison of the drawer's resource labels, attribute list, and filtering is still needed. Proposal creation flows remain unavailable and disabled.
