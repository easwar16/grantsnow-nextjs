# Proposal FEC Summary analysis flow

- **Date / author / agent:** 2026-10-29 / easwar / Codex
- **Branch / base commit:** `feature/proposals-vbcs-parity-20261026`; existing uncommitted Proposal work preserved.
- **Why:** `proposals-fec-summary` was absent from Next.js. The VBCS page calls the ChatBot service's POST `/costinganalysis` with `user-query` and `proposal-number`, parses NDJSON `data` and `chart` chunks, then shows a filterable table and selectable chart.
- **What changed:** added the role-gated FEC Summary tab/page, server-held token call, browser API endpoint, query and frequent-search UI, dynamic table filters, X/Y field and chart-type controls. Cost columns use the configured currency, the initial X field follows the VBCS year/period/date/name/title preference, and a chart loading failure leaves the table available. The result maps only bounded scalar report rows and chart metadata to the client. Added focused contract and failure tests.
- **Shared pieces used:** Proposal record host/access, `@/lib/api`, `Select`, `MultiSelect`, existing ECharts engine, resource labels/suggestions and authenticated route wrapper. No new dependency.
- **Replaces / overrides:** no earlier FEC page. No owner framework code or Oracle write payload changed.
- **Rules touched:** VBCS `origin/development` is read-only; page access and client response mapping fail closed; a user-triggered Generate request is disabled while pending. The POST is a read-only analysis call, despite its HTTP method.
- **Checks:** typecheck, 853 unit tests and isolated production build passed. Lint: zero errors, one existing TanStack Virtual warning. The final full Playwright suite passed (27 passed, 2 skipped), including the new FEC journey with a captured report response. No live DEV analysis request was sent.
- **Open:** the VBCS chart supports types outside the existing ECharts engine (for example box plot, stock and pyramid); the Next.js selector currently exposes only engine-supported types returned by the service. Live DEV analysis and visual parity have not been exercised. The remaining Proposal flows are inventoried in `docs/proposals-flow-inventory.md`.
