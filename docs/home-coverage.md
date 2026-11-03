# Current Home coverage

Updated 2026-10-22. The current implementation and remaining parity gaps are described in [dashboard-parity.md](dashboard-parity.md). No exact/full VBCS sign-off is claimed.

Nine attention widgets remain configured/module-gated: Proposal deadlines/approvals, Contract deadlines/approvals, Ethics deadlines/approvals, Award approvals/approved awards and EOI approvals. Home itself is an authenticated context page with no page grant: legacy has no DASHBOARD `home` read grant (DASHBOARD roles describe actions). Each widget requires its module grant (`module_access`), its dashboard preference `isVisible === true` and token-bound backend scope; a missing grant or preference hides it and its API refuses it.

**Deliberately stricter than legacy (owner: make access role-based, fail closed).** Legacy shows a widget on the preference alone and lets the backend return whatever the token permits; here the module grant is also required, in the page and again in `/api/home/[widget]`.

## Need Attention queues

**Paging.** Live DEV (2026-10-22, network tab) requests every queue with `?p_offset=0&p_limit=25`, as the legacy SDP paginate transform (`services/transforms.js` `paginate`) does for every non-claims read. Each queue loads 25 rows, then the next 25 when its list (max-height 300px) is scrolled to the end, up to 100 rows (legacy `loadMoreOnScroll`, `max-count 100`; owner rule GN-Dashboard). There is no Prev/Next. The envelope's `hasMore` is unreliable on these endpoints, so a full page means "may have more". The API refuses offsets off the 25-row grid or at/after 100. Refresh restarts at the first page and cancels an in-flight page; late responses are discarded. Notifications and Insights statistics use the same `p_offset`/`p_limit` params (statistics: 100 per page until a short page). The Funding Efficiency gauge sends no paging, as legacy.

**Overdue (legacy defect fixed).** Legacy colours a row when `getDateDiff(<field>) <= 0`, i.e. `moment(field).diff(moment(), 'days')`: truncated milliseconds, so tomorrow already counts, and `moment(undefined)` is now, so a missing field paints every row. The proposal-deadline queue tests `submission_deadline_date`, which `/Proposal/prop_appr_deadline/` never returns, so every row was pink. The rebuild keeps the intent (due today or earlier) on **calendar days in local time** (`src/features/modules/home/deadline.ts`). Date-only and timestamp values use their leading `YYYY-MM-DD`, the same date the row shows. A missing date is never overdue. The calendar day is the server's (the user's timezone is unknown server-side; marked `ponytail:`).

| Queue                 | Date shown               | Overdue tested on                                           |
| --------------------- | ------------------------ | ----------------------------------------------------------- |
| pApproachingDeadlines | `deadline_date`          | `deadline_date` (legacy: `submission_deadline_date`, fixed) |
| pPendingApprovals     | `proposal_creation_date` | `appr_deadline_date` (legacy: creation date, always past)   |
| cApproachingDeadlines | `deadline_date`          | `deadline_date`; past dates note "Overdue by N Days"        |
| cPendingApprovals     | `contract_start_date`    | `contract_start_date` (as legacy)                           |
| eApproachingDeadlines | `deadline_date`          | `deadline_date`                                             |
| ePendingApprovals     | `appr_deadline_date`     | `appr_deadline_date`                                        |
| aPendingApprovals     | `award_creation_date`    | `appr_deadline_date` (as legacy)                            |
| aApprovedAwards       | `last_approval_date`     | `appr_deadline_date` (as legacy)                            |
| eoiPendingApprovals   | `eoi_creation_date`      | `appr_deadline_date` (legacy: creation date, always past)   |

`appr_deadline_date` is not in the OpenAPI schema of `pendingApproval` or `approvedAwards`; until a live payload shows it, those rows are simply never overdue. Verify on DEV.

**Row links (D23).** Every row links: Proposal rows open the Summary `/proposals/<proposal_type>/<proposal_id>` (falling back to the listing filtered by reference when the type or id is invalid); EOI rows open `/opportunities/eoi/<request_id>`; Contract, Ethics and Award rows open the `/modules/<module>` placeholder with legacy's navigation params as query (`contract_id`/`mode`, `access_type`/`setup_flow_id`, `award_id`/`mode`). The placeholder does not read them yet. As legacy did, an Ethics row (list or calendar View) first asks `GET /api/home/ethics-access` (`getDynamicFormsCheckApplApprAccess`, answered once per token and cached server-side); a deny shows the error toast "Access not Granted" / "Please Contact your System Admin". `hasAccess` true/`"true"`/`"Y"` grants (GN-Angular contract, not yet confirmed against live DEV).

**Formatting.** Dates use `DEFAULT_DATE_FORMAT` (legacy uppercases it into a moment pattern; `dd-MMM-yyyy` → `05-Sep-2026`). Money uses `maximumFractionDigits = DECIMAL_PLACES_COUNT || 2` and `minimumFractionDigits = DECIMAL_PLACES_COUNT || 0` (legacy `formatCurrency`). Both are display-only; values sent or stored are never rounded. If `getGlobalVar` fails, Home renders with the defaults.

## Source Insights panels

| Preference                  | Operation                            | Source mapping / render                                                                     |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| ProposalsValuByCostRecovery | getProposalGetProposalStatistics     | SCATTER_CHART: x/Y; individually coloured points, full width                                |
| grantCategoriesChart        | getSharedGetTopOppCategoryStat       | SECTORS, NUM_PROP/AMOUNT; dual-axis combo, only when enabled                                |
| pByYearChart                | getProposalGetProposalStatistics     | YEAR_STATUS: label/code/value; grouped bars                                                 |
| totalPAValueByYearChart     | getPost_awardsAwardVsCostStatistics  | label/seriesid/value; lines                                                                 |
| opportunityStatusChart      | getSharedGetOppFunnelStat            | label_txt/amount/display_order; funnel                                                      |
| fundingByGrantChart         | getSharedGetOppCategoryStat          | SECTORS and APPLIED_AMT/AWARDED_AMT; paired bars                                            |
| highestGapsChart            | getSharedGetOppCategoryStat          | Awarded Amount and Applied−Awarded; preserves negative gaps                                 |
| fundingEfficiencyIndexChart | getSharedGetWidgetParameters         | p_token header; select DASHBOARD_FEI, then validate FEI_VALUE/LOW/MEDIUM/TARGET; half gauge |
| pByStatusChart              | getProposalGetProposalStatistics     | PROP_STATUS; pie                                                                            |
| eByStatusChart              | getDynamicFormsApplicationStatistics | ETHICS_STATUS; pie                                                                          |
| eByOrgChart                 | getDynamicFormsApplicationStatistics | ETHICS_ORG; pie                                                                             |
| eByRiskChart                | getDynamicFormsApplicationStatistics | ETHICS_RISK; bars                                                                           |
| pByFacultyChart             | getProposalGetProposalStatistics     | PROP_FACULTY; pie                                                                           |
| awardedProposalsChart       | getPost_awardsAwardStatistics        | AWARD_FACULTY; pie                                                                          |
| aByStatusChart              | getPost_awardsAwardStatistics        | AWARD_STATUS; pie                                                                           |

aByStatusChart is `getAwardStatsbyStatusSDP` → `getPost_awardsAwardStatisticsFetch` with `chart_type: AWARD_STATUS` in legacy; the KB line placing `AWARD_STATUS` on `getProposalGetProposalStatistics` is wrong.

The source configuration also contains aByFacultyChart, but current HTML uses awardedProposalsChart for that panel; no duplicate/orphan chart is invented. Fifteen preferences were enabled in the observed account including that orphan; fourteen corresponding source panels are represented. grantCategoriesChart is supported but disabled in that live account.

Statistics load only when Insights is selected. Server services consume all finite API pages before rendering a chart; repeated/inconsistent pages or the bounded result limit produce an error rather than a misleading partial chart. Pie percentages follow the source largest-remainder rounding to 100 while keeping raw counts in accessible tables. Currency comes from verified resource/global configuration; counts are not relabelled as currency.

Year/quarter/month accept the source's comma-separated multi-selection and apply only to Insights operations. Year options are current year down to 1995; quarter/month options match the checked-in source. Organization comes from the existing authorized heading selector. These filters live in the URL, survive reload/history and preserve keyboard focus. No browser username/person header is forwarded.

Need Attention's calendar view shows the same loaded rows as the list; a notice says when more rows can still be loaded. This is not full legacy calendar parity. Chart→listing drills are deferred. For Proposals by Year, legacy ticket 9143 (commit `e2d996bcc`) fixed the drill by filtering on the row's `status_code` instead of mapping the status description back through the PROPOSAL_STATUS lookup; a port should do the same.

KPI trend sparklines show a missing value as a gap in the line, not as zero. Detail/create/convert/inline approval and other record-module mutations remain outside the read-only dashboard views. Other dashboard tabs and their write/read limits are listed in dashboard-parity.md.
