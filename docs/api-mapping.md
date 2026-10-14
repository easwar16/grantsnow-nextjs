# Foundation API and field mapping

2026-10-14 additions: getSharedAnnouncements (token/module_name), getSharedGetKpiStatistics (token/report_name/p_org_id), lookup types/person/sponsor operations and getProposalProposal_id at /Proposal/proposal/{proposal_id}. Proposal Summary roles use token/p_obj_id/p_obj_type and explicit proposals-summary read before fetching. Current source HEAD b5bdcc31538ea292f2ca4ae4b09125914c2f90a5; initial source baseline below is retained as historical evidence. Applicant/assigned/activity/type/updated/tags fields now map from created_by/assigned_to_name/activity_type_descr/proposal_type_descr/last_update_date/tags, gated by corresponding list-* resource keys. Status/risk chips map proposal_status_code/risk_code/risk_desc.


Verified legacy checkout: `/Users/easwar/Developer/GrantsNow` at `6f1c81f0cc70d11b1ad0f1881e3a2f5db0c3675e`. Inventory baseline: branch 9248, `3acfe9e272e2db076d92942ebbf86776ae583077`. Current files were read without changing legacy state. The supplied three artifacts are copied into `docs/migration`. No catalogue credential identifiers/secret values were copied.

Machine-readable operation/required-header allowlist: `src/server/api/operations.json`, derived from the two current OpenAPI files. Response schemas are backed by current VBCS page models/chains, because OpenAPI declares responses under `default`, often with incomplete checked-in examples. Runtime/live payload compatibility is unverified.

## Session

| Operation | Path | Trusted input | Response mapping |
| --- | --- | --- | --- |
| base/getSessionLogin | GET /session/login | service authorization + verified username header | token, expiry_datetime; pid→personId, org_id→organizationId, full_name→name, org_name→organization; module_access[].module_name/is_accessible Y→explicit module grant; landing_module |
| base/getSessionValidate | GET /session/validate | service authorization + DB token | current identity/modules; expiry/token when provided, otherwise protected cookie values |
| base/getSessionExtend_token | GET /session/extend_token | service authorization + DB token | returned expiry/token, bounded by verified IDCS lifetime |
| base/getSessionLogout | GET /session/logout | service authorization + DB token | business success/failure, independent of local cleanup |

Evidence: shell beforeEnter/validate/endSession/ExtendSession chains and base schemas/examples. HTTP success does not imply business success.

## Proposal listing

`apps/getPre_awardGetProposalsList`: GET `/pre_award/getProposalsList/`, token header plus service credential. Only this existing read operation is used, not advanced mutation operations. Legacy `getPre_awardGetProposalsListFetch.js`, `proposals-start-page.js/json/html` and `services/apps/transforms.js` establish the contract.

| Source field | Display model | Visibility/format |
| --- | --- | --- |
| proposal_type + proposal_id | id | Stable composite identity; duplicate identities rejected |
| proposal_number | reference | Always displayed, non-destructive/non-detail |
| proposal_title | title | Always displayed, plain escaped text |
| proposal_status_value | status | Display text, no invented status conversion |
| proposal_type | type | Distinguishes PROPOSAL / OUTLINE_PROPOSAL |
| full_name | investigator | proposal/labels/list-investigator is_visible Y |
| org_unit_name | organization | list-department Y |
| primary_sponsorer | sponsor | list-primary-sponsor Y (legacy spelling preserved) |
| creation_date | created | list-created-on Y; original calendar date, en-GB |
| proposal_start_date/end_date | start/end | list-start-date/list-end-date Y |
| total_cost + currency_code | value/currency | list-total-cost Y; ISO currency when present, masks preserved |

Mandatory reference/title/status/type mirror always-present legacy listing information. Optional hidden fields are removed on the server, not merely hidden with CSS. Unknown additional raw API fields never reach the client. No organization/currency/value is invented when absent.

ORDS query: `q` JSON combines `$and` criteria and `$orderby:{field:'ASC'|'DESC'}`. Legacy `$co` becomes `$instr`; creation-date bounds become `$gte`/`$lte` with `$date` and inclusive UTC-day endpoints. `p_offset=(page-1)*pageSize`, `p_limit=pageSize`. Title search, reference contains, status-code equality, faculty/sponsor contains, investigator employee-number equality, proposal-type equality and creation-date range are implemented. Department code and assigned-to person ID equality, activity/proposal category code equality and match-any tags are also implemented from current fetchFilterCriteria. Arbitrary customer-defined advanced criteria and lookup dropdown parity are deferred until their configuration contracts are approved. Code/ID fields are explicitly labelled rather than populated with guessed options. No unsupported `search`/`page` parameter is sent to Oracle.

`items` contains page rows, `total_count` is reported as **API total** (filtered versus global interpretation still requires DEV proof), `offset` checked when present; `size` is legacy loaded-so-far count and is never interpreted as total. `hasMore` used if provided, otherwise derived solely from total_count and requested offset. Missing both hasMore/total metadata is a contract failure, not a guessed total. No local page-only filtering.

## Configuration/scope

- `/shared/dashboardPreferences`: needAttention/insights `isVisible` + theme; missing configuration fails rather than granting widgets.
- `/shared/labels`, module_name DASHBOARD,PROPOSAL: current shell restructures array rows `module_name,label_type,label_name,label_value,is_visible`; new adapter uses these directly. Text labels fall back to documented source equivalents; optional visibility requires Y.
- `/security/user_roles`, p_obj_type DASHBOARD: page_name/read_access; Home requires explicit `home` Y. Listing requires PROPOSALS module and existing token row scope (legacy listing checkAccess gates module, not an invented page grant).
- `/pre_award/getLkpOrgUnitType` with trusted person_id: permitted Home organizations; field names normalized case-insensitively just as legacy prepareOrgUnitData does. Submitted org IDs must be in that returned set. No browser person_id accepted. Partial lookup paging cannot widen scope; administrator must verify complete lookup delivery before exposing every permitted organization.

## Home

Detailed widgets/paths/charts in `home-coverage.md` and typed registry `src/server/home/widgets.ts`. Common queue envelope: items plus hasMore/offset when supplied. Default ORDS pagination `offset/limit` mirrors generic legacy transform, not Proposal p_offset/p_limit. Rendered rows are labelled page rows. No chart/list reconciliation claim without live records.

Proposal queue fields: proposal_id/number/title, faculty_name, deadline_date/appr_deadline_date/stage_name. Contract: contract_id/number/title/org_unit_name. Ethics: setup_flow_id/application_number/setup_description/org_unit_name. Awards: award_id/number/name (proposal_title fallback present in approved-award source)/faculty_name. EOI: request_id/number/opp_heading/org_unit_name. Dates/stage shown only if present. Keys include deadline/stage to preserve multiple queue entries for a record.

Statistics: existing items label/code/value mapped to accessible bar rows with actual raw values. Chart semantics are inherited from existing statistics APIs, with headers chart_type, p_org_id, year/quarter/month. No fabricated KPIs or proposal totals. Year/status chart click-through is deliberately deferred until DEV creation-date/status reconciliation can be verified (historical 9143 mismatch).
