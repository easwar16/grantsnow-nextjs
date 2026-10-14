# Current Home coverage

Updated 2026-10-14. The current implementation and remaining parity gaps are described in [dashboard-parity.md](dashboard-parity.md). No exact/full VBCS sign-off is claimed.

Nine attention widgets remain configured/module-gated: Proposal deadlines/approvals, Contract deadlines/approvals, Ethics deadlines/approvals, Award approvals/approved awards and EOI approvals. Home itself is an authenticated context page; each widget requires its actual module grant, explicit account visibility and token-bound backend scope. There is no invented DASHBOARD home-read exemption that grants other modules.

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

The source configuration also contains aByFacultyChart, but current HTML uses awardedProposalsChart for that panel; no duplicate/orphan chart is invented. Fifteen preferences were enabled in the observed account including that orphan; fourteen corresponding source panels are represented. grantCategoriesChart is supported but disabled in that live account.

Statistics load only when Insights is selected. Server services consume all finite API pages before rendering a chart; repeated/inconsistent pages or the bounded result limit produce an error rather than a misleading partial chart. Pie percentages follow the source largest-remainder rounding to 100 while keeping raw counts in accessible tables. Currency comes from verified resource/global configuration; counts are not relabelled as currency.

Year/quarter/month accept the source's comma-separated multi-selection and apply only to Insights operations. Year options are current year down to 1995; quarter/month options match the checked-in source. Organization comes from the existing authorized heading selector. These filters live in the URL, survive reload/history and preserve keyboard focus. No browser username/person header is forwarded.

Need Attention retains the basic calendar/list implementation over the same authorized rows; a hasMore notice identifies partial events. This is not full legacy calendar parity. Chart→listing drills are deferred until actual status/year/faculty reconciliation can be demonstrated. Detail/create/convert/inline approval and other record-module mutations remain outside the read-only dashboard views. Other dashboard tabs and their write/read limits are listed in dashboard-parity.md.
