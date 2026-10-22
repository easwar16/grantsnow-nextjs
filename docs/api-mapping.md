# Foundation API and field mapping

2026-10-14 additions: getSharedAnnouncements (token/module_name), getSharedGetKpiStatistics (token/report_name/p_org_id), lookup types/person/sponsor operations and getProposalProposal_id at /Proposal/proposal/{proposal_id}. Proposal Summary roles use token/p_obj_id/p_obj_type and explicit proposals-summary read before fetching. Current source HEAD b5bdcc31538ea292f2ca4ae4b09125914c2f90a5; initial source baseline below is retained as historical evidence. Applicant/assigned/activity/type/updated/tags fields now map from created_by/assigned_to_name/activity_type_descr/proposal_type_descr/last_update_date/tags, gated by corresponding list-* resource keys. Status/risk chips map proposal_status_code/risk_code/risk_desc.

Verified legacy checkout: `/Users/easwar/Developer/GrantsNow` at `6f1c81f0cc70d11b1ad0f1881e3a2f5db0c3675e`. Inventory baseline: branch 9248, `3acfe9e272e2db076d92942ebbf86776ae583077`. Current files were read without changing legacy state. The supplied three artifacts are copied into `docs/migration`. No catalogue credential identifiers/secret values were copied.

Machine-readable operation/required-header allowlist: `src/server/api/operations.json`, derived from the two current OpenAPI files. Response schemas are backed by current VBCS page models/chains, because OpenAPI declares responses under `default`, often with incomplete checked-in examples. Runtime/live payload compatibility is unverified.

## Session

| Operation                   | Path                      | Trusted input                                    | Response mapping                                                                                                                                                                      |
| --------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/getSessionLogin        | GET /session/login        | service authorization + verified username header | token, expiry_datetime; pid→personId, org_id→organizationId, full_name→name, org_name→organization; module_access[].module_name/is_accessible Y→explicit module grant; landing_module |
| base/getSessionValidate     | GET /session/validate     | service authorization + DB token                 | current identity/modules; expiry/token when provided, otherwise protected cookie values                                                                                               |
| base/getSessionExtend_token | GET /session/extend_token | service authorization + DB token                 | returned expiry/token, bounded by verified IDCS lifetime                                                                                                                              |
| base/getSessionLogout       | GET /session/logout       | service authorization + DB token                 | business success/failure, independent of local cleanup                                                                                                                                |

Evidence: shell beforeEnter/validate/endSession/ExtendSession chains and base schemas/examples. HTTP success does not imply business success.

## Proposal listing

`apps/getPre_awardGetProposalsList`: GET `/pre_award/getProposalsList/`, token header plus service credential. Only this existing read operation is used, not advanced mutation operations. Legacy `getPre_awardGetProposalsListFetch.js`, `proposals-start-page.js/json/html` (`fetchFilterCriteria`) and `services/transforms.js` (the `apiList` branch of `prepareQuery` / `addQParam` / `paginate`) establish the contract. `services/apps/transforms.js` is unused: `openapi3.json` points at `../transforms.js`.

| Source field                 | Display model  | Visibility/format                                             |
| ---------------------------- | -------------- | ------------------------------------------------------------- |
| proposal_type + proposal_id  | id             | Stable composite identity; duplicate identities rejected      |
| proposal_number              | reference      | Always displayed, non-destructive/non-detail                  |
| proposal_title               | title          | Always displayed, plain escaped text                          |
| proposal_status_value        | status         | Display text, no invented status conversion                   |
| proposal_type                | type           | Distinguishes PROPOSAL / OUTLINE_PROPOSAL                     |
| full_name                    | investigator   | proposal/labels/list-investigator is_visible Y                |
| org_unit_name                | organization   | list-department Y                                             |
| primary_sponsorer            | sponsor        | list-primary-sponsor Y (legacy spelling preserved)            |
| creation_date                | created        | list-created-on Y; original calendar date, en-GB              |
| proposal_start_date/end_date | start/end      | list-start-date/list-end-date Y                               |
| total_cost + currency_code   | value/currency | list-total-cost Y; ISO currency when present, masks preserved |

Mandatory reference/title/status/type mirror always-present legacy listing information. Optional hidden fields are removed on the server, not merely hidden with CSS. Unknown additional raw API fields never reach the client. No organization/currency/value is invented when absent.

Query contract (verified 2026-10-22 against legacy `origin/development` and the live DEV VBCS network tab). The backend takes a SQL `p_where_clause`, not ORDS `q` JSON:

- Initial load (live): `GET /pre_award/getProposalsList/?p_offset=0&p_limit=10`, with no where clause and no sort.
- Title filter "test" (live): `GET /pre_award/getProposalsList/?p_where_clause=(LOWER("proposal_title") LIKE LOWER('%test%'))&p_offset=0&p_limit=10`.

The server builds the clause in `src/server/proposals/where-clause.ts`; the browser sends only the validated feature query (`src/features/proposals/schemas.ts`) and never SQL, `q` or `p_*` parameters. The criteria follow legacy `fetchFilterCriteria` order, joined with `AND` inside one pair of parentheses:

| Query param        | Column                   | Clause                                                     |
| ------------------ | ------------------------ | ---------------------------------------------------------- |
| `reference`        | `proposal_number`        | `LOWER("proposal_number") LIKE LOWER('%v%')`               |
| `search`           | `proposal_title`         | `LOWER("proposal_title") LIKE LOWER('%v%')`                |
| `status`           | `proposal_status_code`   | `"proposal_status_code"='v'` (status tabs)                 |
| `faculty`          | `faculty_name`           | LIKE (no UI; legacy input commented out)                   |
| `department`       | `pi_dept_code`           | `"pi_dept_code"='v'`                                       |
| `sponsor`          | `primary_sponsorer`      | LIKE                                                       |
| `from`             | `creation_date`          | `"creation_date">='YYYY-MM-DD 00:00:00'` (local day start) |
| `to`               | `creation_date`          | `"creation_date"<='YYYY-MM-DD 23:59:59'` (local day end)   |
| `type`             | `proposal_type`          | `"proposal_type"='v'` (category radios)                    |
| `activityType`     | `activity_type_lkp_code` | equality                                                   |
| `proposalCategory` | `proposal_type_lkp_code` | equality                                                   |
| `investigator`     | `pi_employee_number`     | `("pi_employee_number"='v')`: legacy one-item `$or` group  |
| `assignedTo`       | `assigned_to`            | `("assigned_to"='v')`: legacy one-item `$or` group         |
| `tags` (comma)     | `tags`                   | `(LOWER("tags") LIKE … OR LOWER("tags") LIKE …)`           |

Values are always quoted literals, as legacy sends them (numbers included). Sorting: `p_order_by="<column>"` (double-quoted, as legacy) plus `p_sort_order=ASC|DESC`, sent only when a sort column is chosen; the default is backend order (legacy `dateSort` has no attribute until the user picks one). Sort columns are the configured Date Sort list, `apps/getSharedGetObjectDates` with `p_obj_type: PROPOSAL` (legacy `fetchDateTypes`); the server rejects a sort that is not in that list. Paging: `p_offset=(page-1)*pageSize`, `p_limit=pageSize`, default 10 (live).

Legacy defects fixed: values were concatenated unescaped (a `'` broke or injected SQL), and any column/operator could be sent. Now columns come from a fixed allowlist, sort names must match `^[A-Za-z][A-Za-z0-9_]*$` and the configured list, codes/ids are schema-validated, and single quotes are doubled. Kept as legacy: `%` and `_` in a LIKE value remain wildcards; escaping them needs an `ESCAPE` clause the backend is not known to accept (owner improvement). Legacy's unanchored date regex also appends a time to any equality value containing a date; the rebuild appends times only to the `from`/`to` bounds. Arbitrary advanced-filter rows (legacy `advancedFilterData`) are not implemented.

Fixture transport (`src/test-support/transport.ts`) still evaluates `q` JSON, so fixture-mode filtering and sorting no longer apply until it parses the structured criteria.

`items` contains page rows; `total_count` is the **API total** (filtered versus global interpretation still requires DEV proof); `offset` is checked when present; `size` is the legacy loaded-so-far count and is never a total. `hasMore` is ignored: on this backend it can be `true` on a short last page, `false` mid-list, or the string `"true"`. More pages exist when `offset + rows < total_count`, or, without `total_count`, when the page came back full. No local page-only filtering.

## Configuration/scope

- `/shared/dashboardPreferences`: needAttention/insights `isVisible` + theme; missing configuration fails rather than granting widgets.
- `/shared/labels`, module_name DASHBOARD,PROPOSAL: current shell restructures array rows `module_name,label_type,label_name,label_value,is_visible`; new adapter uses these directly. Text labels fall back to documented source equivalents; optional visibility requires Y.
- `/security/user_roles`, p_obj_type DASHBOARD: page_name/read_access, used for DASHBOARD widget rights and object roles (every row for a page must grant read); Home itself has no page grant. Listing requires PROPOSALS module and existing token row scope (legacy listing checkAccess gates module, not an invented page grant; legacy denied only an explicit `false`, the rebuild fails closed).
- `/security/user_roles`, p_obj_type = proposal type, p_obj_id = proposal id: the Summary needs `proposals-summary` read. `objectAccess` (`src/server/proposals/record.ts`) grants a right only when every row for the page grants it, so no rows, a missing page or any `N` denies (legacy: last duplicate row wins for `access`, while its entry gate denies on any `proposals-summary` read `N`).
- `/pre_award/getLkpOrgUnitType` with trusted person_id: permitted Home organizations; field names normalized case-insensitively just as legacy prepareOrgUnitData does. Submitted org IDs must be in that returned set. No browser person_id accepted. Partial lookup paging cannot widen scope; administrator must verify complete lookup delivery before exposing every permitted organization.

## Home

Detailed widgets/paths/charts in `home-coverage.md` and typed registry `src/server/home/widgets.ts`. Common queue envelope: items plus hasMore/offset when supplied. Default ORDS pagination `offset/limit` mirrors generic legacy transform, not Proposal p_offset/p_limit. Rendered rows are labelled page rows. No chart/list reconciliation claim without live records.

Proposal queue fields: proposal_id/number/title, faculty_name, deadline_date/appr_deadline_date/stage_name. Contract: contract_id/number/title/org_unit_name. Ethics: setup_flow_id/application_number/setup_description/org_unit_name. Awards: award_id/number/name (proposal_title fallback present in approved-award source)/faculty_name. EOI: request_id/number/opp_heading/org_unit_name. Dates/stage shown only if present. Keys include deadline/stage to preserve multiple queue entries for a record.

Statistics: existing items label/code/value mapped to accessible bar rows with actual raw values. Chart semantics are inherited from existing statistics APIs, with headers chart_type, p_org_id, year/quarter/month. No fabricated KPIs or proposal totals. Year/status chart click-through is deliberately deferred until DEV creation-date/status reconciliation can be verified (9143, commit `e2d996bcc`, fixed a status description-to-code lookup; whether the year drill on `creation_date` matches the chart is still unverified).

## Dashboard tab/Insights additions — 2026-10-14

Current source mappings and render coverage are in home-coverage.md and dashboard-parity.md. Added verified GET operations: `/notifications/notifications/` (token; standard offset/limit metadata), `/shared/getDynamicCharts` (token, p_org_id, report_name selected from enabled configuration), `/post_awards/AwardVsCostStatistics`, `/shared/getOppCategoryStat`, `/shared/getTopOppCategoryStat`, `/shared/getOppFunnelStat`, and `/shared/getWidgetParameters` (the last uses **p_token**, not token). Existing date-filter headers are propagated where declared. Legacy category chains flatten APPLIED_AMT/AWARDED_AMT and calculate the explicit applied-minus-awarded gap; raw fields stay server-only.

Home Featured Opportunities uses the global legacy transform's fixed `p_where_clause`: preference=Y AND opportunity_status!=CLOSED, plus p_offset/p_limit. No client raw SQL is accepted. Module/resource/financial-count gates are shared with Finder.

Chart preference POST is deliberately separate from the read-operation allowlist: the single fixed `/shared/saveDynamicCharts` path accepts strict numeric layout preferences only after same-origin/auth/report/resource checks. No proposal/approval/opportunity record writes are added through a generic proxy. Its success may have an empty body, as the source contract declares no response schema; nonempty JSON business errors still reject the operation.
