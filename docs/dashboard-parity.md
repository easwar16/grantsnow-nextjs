# Dashboard parity — current increment, 2026-10-14

The implementation is in `/Users/easwar/.superset/worktrees/gratsnow nextjs/faceted-rook-b1710e7e`. The VBCS preview and current read-only legacy source were compared at 1800×1043 CSS pixels using the same account. This is a substantial visual and read-data increment, **not a declaration of exact or complete application parity**.

## Shell and loading

The navigation drawer uses the original `sidebar-background-pattern.png`, source brand colour, Oracle UX icon font, 241px desktop reflow and compact rows. Only implemented destinations with verified module grants appear. The user menu has profile context/session controls, browser-session display preferences and accessibility controls; server preference/profile editing is not complete. Header Help/notification controls and unbuilt navigation modules remain outstanding.

Home, Proposal listing/Summary, Opportunities listing/analytics and EOI pages have geometric skeletons. Refreshing records replaces only the affected content, without hiding filters or the shell. KPI, chart, table and record placeholders are separate. Screen readers receive loading status/aria-busy; reduced-motion disables shimmer. Insights placeholders keep the final 153px plot height. KPI loading is an independent server Suspense boundary. Verified DEV KPI/Award aggregations took approximately 42/31 seconds; allowlisted statistics operations use a bounded 60-second timeout while ordinary reads retain 15 seconds.

## Dashboard tabs

| Tab            | Implemented behaviour                                                                                                                                                                             | Boundary                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Need Attention | Nine configured queues; independent loading/error/empty/retry; authorized paged rows, existing basic list/calendar controls                                                                       | Other record modules and approval mutations remain separate work                                  |
| Insights       | Source panel order, full-width cost plot, paired charts, measured Oracle colour palette, source chart types, multi-select Year/Quarter/Month, organization scope, expansion and accessible tables | Proposal chart→listing reconciliation/drill-down is still deferred; no guessed status/org filters |
| Opportunities  | Featured/not-closed server filter, authorized cards, summary preview, external funder link, pagination, View all opportunities                                                                    | Bookmark/share/notes/apply/convert mutations are not implemented in this Home tab                 |
| Notifications  | Token-scoped messages, sanitized rich text, read/unread indicator, timestamps, API paging, refresh/retry                                                                                          | No notification mutation or invented total badge                                                  |
| Dynamic Charts | Enabled infolets grouped by verified module; independently loaded charts, organization propagation, legend/tooltip/table/expansion rendering and configurable dimensions                          | Unknown module mappings or absent ModuleName fail closed; no arbitrary report IDs                 |

Extra tabs are shown only when account preferences/resource visibility permit them. Opportunity access also requires its actual Finder module. Chart IDs and module capabilities are selected on the server. Every direct API request repeats these checks. Missing configuration never enables a capability.

Dynamic Chart dimension saving is the sole new write in this increment: POST `/shared/saveDynamicCharts` with integer `infolet_id`, `colspan`, `rowspan`. The application POST requires same-origin, a validated session, enabled report and resource-granted Dimensions option. Body fields are strict and bounded 1–12. HTTP 200 business errors do not count as saved. Fixture browser checks exercised saving; **no live Oracle preference write was executed**. Report links require HTTPS, the approved Oracle origin, the observed report-result path and a single numeric report-id parameter; credential/token-bearing or foreign links are discarded.

Both Insights and Dynamic Charts use modular Apache ECharts 6.1.0, loaded when a visible chart needs it. SVG output, reduced motion, resize/dispose handling, scoped mapped data and accessible tables are shared. The native form/dialog/navigation stack is retained. See [official modular import documentation](https://echarts.apache.org/handbook/en/basics/import/) and [accessibility documentation](https://echarts.apache.org/handbook/en/best-practices/aria/).

## Verification and current integration findings

- Unit/integration: 152 checks passed; trusted mappings, invalid targets, chart pagination completeness, disabled/arbitrary report IDs, scope widening, sanitized messages, strict dimension bodies/business errors and filter serialization are covered.
- Chromium fixture journeys: 11 passed, including all dashboard tabs, chart expansion, keyboard focus after filter navigation, filter/reset, notification paging/recovery, chart preference POST/CSRF and skeleton/reduced-motion checks. These are isolated fixture checks, not live IDCS verification.
- TypeScript, ESLint and a production build with fixture/browser-session modes disabled were run. See implementation-status for final recorded results.
- Live DEV: KPI values, cost plot, Proposal year charts, value-by-year lines, category bars and notifications rendered using captured browser-session credentials. Oracle's Funding Opportunity Status operation returned HTTP 555 with a non-JSON body; it remains an independent error/retry state. Award statistics succeeded with a longer timeout. Funding Efficiency ignores unrelated widget settings; missing DASHBOARD_FEI data is an empty state, not a fabricated gauge.
- The enabled live Dynamic Chart returned an empty dataProvider. Its real empty response was verified; nonempty chart rendering/dimension saving was exercised with fixtures.
- Local IDCS is still not verified or enabled; the existing browser-session DEV bridge remains explicit, labelled, server-only and prohibited in production.

Exact OJET interaction/pixel parity is not signed off. In particular: automatic axis layout differs slightly, specialized help/advanced controls and opportunity write workflows remain outstanding, and calendar is a basic authorized-row implementation.

## Verification isolation

Two Next dev processes rewrite the same next-env.d.ts even with separate distDir, causing reload loops. `npm run test:e2e` now copies only source/config/tests/public files into an ignored `.validation/e2e-*` scratch directory, shares installed dependencies and generates its own types/output. It does not copy .env files or captured credentials. Failure artifacts are copied back to test-results. The user's live port 3000 server remains in the original workspace.

For a production verification build without replacing the live dev output:

```sh
GRANTSNOW_BUILD_CHECK=true DEV_BROWSER_SESSION=false FIXTURE_MODE=false npm run build
```

This prepares `.next-check/standalone` and static/public assets. Ordinary `npm run build` and `npm start` continue to use `.next` as documented for deployment.
