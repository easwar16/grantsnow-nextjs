# Home coverage

2026-10-14 additions: protected configured KPI strip via getSharedGetKpiStatistics, basic sanitized announcements via getSharedAnnouncements, Need Attention/Insights tabs and VBCS visual row foundation. Exact/full dashboard parity remains incomplete; see vbcs-parity-progress.md.

All rows below have read-only server adapters, isolated fixture data and per-widget loading/error/empty/retry UI. Each is enabled only when the corresponding session module is explicitly accessible, DASHBOARD home read is granted, and dashboard preference `isVisible===true`. The real DEV configuration/response/scope has not been exercised.

| Preference key        | Operation / verified path                                              | Status                                                                 |
| --------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| pApproachingDeadlines | getProposalProp_appr_deadline /Proposal/prop_appr_deadline/            | Implemented                                                            |
| pPendingApprovals     | getProposalPendingApproval /Proposal/pendingApproval                   | Implemented                                                            |
| cApproachingDeadlines | getContractsContract_appr_deadline /contracts/contract_appr_deadline   | Implemented                                                            |
| cPendingApprovals     | getContractsContractPendingApproval /contracts/ContractPendingApproval | Implemented                                                            |
| eApproachingDeadlines | getDynamicFormsApplApprDeadline2 /dynamicForms/applApprDeadline        | Implemented                                                            |
| ePendingApprovals     | getDynamicFormsApplPendingApproval /dynamicForms/applPendingApproval   | Implemented                                                            |
| aPendingApprovals     | getPost_awardsAwardPendingApproval /post_awards/awardPendingApproval   | Implemented; live shape needs verification (source page type is any[]) |
| aApprovedAwards       | getPost_awardsApprovedAwards /post_awards/approvedAwards               | Implemented                                                            |
| eoiPendingApprovals   | getEoiPendingApproval /dynamicForms/eoiPendingApproval                 | Implemented                                                            |

The eight supported insight preferences use real statistics contracts:

| Preference key  | Operation                            | chart_type    |
| --------------- | ------------------------------------ | ------------- |
| pByYearChart    | getProposalGetProposalStatistics     | YEAR_STATUS   |
| pByStatusChart  | getProposalGetProposalStatistics     | PROP_STATUS   |
| pByFacultyChart | getProposalGetProposalStatistics     | PROP_FACULTY  |
| aByStatusChart  | getPost_awardsAwardStatistics        | AWARD_STATUS  |
| aByFacultyChart | getPost_awardsAwardStatistics        | AWARD_FACULTY |
| eByStatusChart  | getDynamicFormsApplicationStatistics | ETHICS_STATUS |
| eByOrgChart     | getDynamicFormsApplicationStatistics | ETHICS_ORG    |
| eByRiskChart    | getDynamicFormsApplicationStatistics | ETHICS_RISK   |

Organization applies to attention and insights using p_org_id; Award attention uses org_id. Year/quarter/month apply to insights only, consistent with the chain contracts. Values come directly from the statistics API, without calculating totals or labelling raw numbers as invented currency/KPIs. Proposal drill-down links use returned proposal_number as verified reference filter. View Proposals works; other module rows are noninteractive because those destinations are unbuilt.

Explicit initial deferrals:

- Calendar mode: legacy accumulates paged events and sometimes clears/duplicates state during filtering. This increment renders independent paged lists; complete event consistency across filters/paging requires a tested event-loading policy. No misleading incomplete calendar is shown.
- Chart→listing drill-down: legacy 9143 uses creation_date and status-specific semantics; available charts have label/code rather than guaranteed status_code. Until actual statistics/list reconciliation is verified, no guessed status/date drill-down link is exposed.
- Dynamic configured charts/reports, scatter cost recovery, Proposal/Award cost comparison, opportunity insights and specialized KPI formulas: need their metadata/units/permissions and live contracts reconciled before reproducing them. Only the eight typed statistic views above are implemented. No invented counters substitute for them.
- Theme catalogue/custom themes and legacy user preference mutation dialogs: default/dark rendering only; no writes to preferences/resources.
- Home creation/convert/inline approval dialogs, notifications/actions, opportunities, details, attachments, record calendar links: outside this read-only increment. No inactive/dead action buttons.

Externally blocked: actual customer preference visibility, authorized org list completeness, queue response/paging/ordering, statistics meaning/date range, backend row scope, and real IDCS/ORDS connectivity. Fixture tests cannot approve production parity.

### Visual iteration update (2026-10-14)

Initial calendar deferral is superseded by a working month grid with List/Calendar controls using the same authorized queue rows, keyboard month buttons and explicit partial-result indication. Source calendar styling/event drill-down parity remains open. Organization selection is in the Home heading; year/quarter/month controls are under Insights. Deadline types use actual lookup labels; source creation/deadline dates control overdue styling. Current measured evidence/remaining gaps are recorded in vbcs-parity-progress.md.
