import "server-only";
import { fixtureMode } from "@/server/configuration/environment";
import type { Operation } from "@/server/api/transport";
import { fixtureUser, proposals } from "./fixtures";
import { widgets } from "@/server/home/widgets";
function matches(
  row: Record<string, unknown>,
  node: Record<string, unknown>,
): boolean {
  if (Array.isArray(node.$and)) return node.$and.every((c) => matches(row, c));
  if (Array.isArray(node.$or)) return node.$or.some((c) => matches(row, c));
  return Object.entries(node).every(([key, ops]) => {
    if (key === "$orderby") return true;
    const value = String(row[key] ?? "");
    return Object.entries(ops as Record<string, unknown>).every(
      ([op, want]) => {
        const target =
          typeof want === "object" && want
            ? String((want as Record<string, unknown>).$date)
            : String(want);
        return op === "$instr"
          ? value.toLowerCase().includes(target.toLowerCase())
          : op === "$eq"
            ? value === target
            : op === "$gte"
              ? value >= target
              : op === "$lte"
                ? value <= target
                : false;
      },
    );
  });
}
export async function mockOracle(
  op: Operation,
  headers: Record<string, string>,
  query?: URLSearchParams,
  pathParams?: Record<string, string>,
): Promise<unknown> {
  if (!fixtureMode())
    throw new Error(
      "Fixture transport cannot run outside explicit development mode.",
    );
  if (op === "getPre_awardGetLookupTypesCodes") {
    const types: Record<string, [string, string][]> = {
      PROPOSAL_STATUS: [
        ["DRFT", "Draft"],
        ["AIA", "Awaiting Internal Approval"],
        ["IA", "Internally Approved"],
        ["REJ", "Rejected"],
        ["SUB", "Submitted to Sponsor"],
        ["AWARD", "Closed Funded"],
      ],
      PROPOSAL_TYPES: [
        ["PROPOSAL", "Proposal"],
        ["SUB_PROPOSAL", "Sub-Proposal"],
        ["OUTLINE_PROPOSAL", "Outline Proposal"],
        ["EXTENSION_PROPOSAL", "Extension Proposal"],
      ],
      ACTIVITY_TYPE: [["CASH", "Cash"]],
      PROPOSAL_TYPE: [["STANDARD", "Standard Proposal"]],
    };
    return {
      items: Object.entries(types).flatMap(([lookup_type_code, rows]) =>
        rows.map(([lookup_code, label]) => ({
          lookup_type_code,
          lookup_code,
          lookup_code_value: label,
          lookup_code_descr: label,
        })),
      ),
    };
  }
  if (op === "getPre_awardGetPersonList")
    return {
      items: [
        { person_id: 101, employee_number: "EMP101", full_name: "Alex Morgan" },
        { person_id: 102, employee_number: "EMP102", full_name: "Sam Taylor" },
      ],
    };
  if (op === "GetSponsorList")
    return {
      items: [
        { party_name: "Research Council" },
        { party_name: "Health Foundation" },
      ],
    };
  if (op === "getSessionLogout") return { response_msg: "SUCCESS" };
  if (op.startsWith("getSession"))
    return {
      ...fixtureUser,
      token: "fixture-backend-token",
      expiry_datetime: new Date(Date.now() + 3600000).toISOString(),
    };
  if (op === "getSharedDashboardPreferences")
    return {
      theme: "theme-default",
      notifications: true,
      opportunity: true,
      dynamicCharts: {
        "Proposal by status": {
          infolet_id: 201,
          isVisible: true,
          ModuleName: "PROPOSAL",
        },
      },
      KPI_STATISTICS: Object.fromEntries(
        [
          "variance_cost_award",
          "variance_price_award",
          "award_yoy",
          "bid_success_rate",
        ].map((id) => [id, { isVisible: true }]),
      ),
      needAttention: Object.fromEntries(
        widgets
          .filter((w) => w.section === "needAttention")
          .map((w) => [w.id, { isVisible: true }]),
      ),
      insights: Object.fromEntries(
        widgets
          .filter((w) => w.section === "insights")
          .map((w) => [w.id, { isVisible: true }]),
      ),
    };
  if (op === "getPre_award_costingGetGlobalVar")
    return {
      items: [
        { var_key: "DEFAULT_CURRENCY_CODE", var_value: "GBP" },
        { var_key: "DEFAULT_DATE_FORMAT", var_value: "DD-MMM-YYYY" },
        { var_key: "DECIMAL_PLACES_COUNT", var_value: "2" },
      ],
    };
  if (op === "getSharedAnnouncements")
    return {
      items: [
        {
          msg: "<p><strong>Development workspace</strong> · Synthetic data for local UI verification.</p>",
        },
        { msg: "<p>Explore the Home dashboard and Proposal listing.</p>" },
      ],
    };
  if (op === "getNotificationsNotifications") {
    const offset = Number(query?.get("offset") || 0);
    return {
      items: Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        notific_content: `<p>Synthetic notification ${i + 1}</p>`,
        is_read: i % 2 ? "Y" : "N",
        datetime: "2026-10-14T10:00:00",
      })).slice(offset, offset + 25),
      offset,
      limit: 25,
      hasMore: offset + 25 < 30,
    };
  }
  if (op === "getSharedGetDynamicCharts")
    return [
      {
        infolet_id: 201,
        chart: "BAR",
        name: "Proposal by status",
        ModuleName: "PROPOSAL",
        colspan: 6,
        rowspan: 3,
        dataProvider: [
          { series: "Draft", group: "2026", value: 12 },
          { series: "Submitted", group: "2026", value: 8 },
        ],
      },
    ];
  if (op === "getSharedGetKpiStatistics")
    return [
      {
        id: "variance_cost_award",
        title: "Cost vs Award Award Variance",
        metric: 42000,
        meta: "Goal: 80%",
        trendColor: "success",
        periodChangeIndicator: { value: 12, comparisonPeriod: "YoY" },
      },
      {
        id: "variance_price_award",
        title: "Price vs Award Variance",
        metric: 18500,
        meta: "Goal: 50%",
        trendColor: "success",
        periodChangeIndicator: { value: 8, comparisonPeriod: "YoY" },
      },
      {
        id: "award_yoy",
        title: "YOY Growth Revenue",
        metric: 540000,
        meta: "Goal: 50%",
        trendColor: "success",
        periodChangeIndicator: { value: 15, comparisonPeriod: "YoY" },
      },
      {
        id: "bid_success_rate",
        title: "Bid Success Rate",
        metric: 70,
        meta: "Goal: 50%",
        trendColor: "success",
        periodChangeIndicator: { value: 10, comparisonPeriod: "YoY" },
      },
    ].map((r) => ({
      ...r,
      trendChart: {
        data: [{ value: 2 }, { value: 3 }, { value: 2.5 }, { value: 4 }],
      },
    }));
  if (
    op === "getSecurityUser_roles" &&
    headers.p_obj_type === "OPPORTUNITIES-EOI"
  )
    return {
      items: [
        "summary",
        "application",
        "attachments",
        "approvals",
        "delegation",
        "history",
        "dynamic-form-1",
        "dynamic-form-2",
        "dynamic-form-3",
        "dynamic-form-4",
        "dynamic-form-5",
      ].map((tab) => ({
        page_name: `opportunities-eoi-${tab}`,
        read_access: "Y",
      })),
    };
  if (op === "getDynamicFormsGetRequestDetails") {
    const id = Number(headers.request_id);
    return {
      items: [
        {
          request_id: id,
          request_number: `EOI_${id - 999}`,
          request_type: "OPPORTUNITIES-EOI",
          status: "Draft",
          status_code: "DRFT",
          creation_date: "2026-10-01",
          ref_object_id: 1,
          ref_object_type: "OPPORTUNITIES",
        },
      ],
    };
  }
  if (
    op === "getPre_awardAttachmentsProposal_id" ||
    op === "getApproval_setupApproval_stages" ||
    op === "getProposalDelegationsProposal_id" ||
    op === "getSharedObjectStatus"
  )
    return { items: [] };
  if (op === "getProposalEthical_dynFormsP_ref_module")
    return [
      {
        formId: 1,
        formName: "Research application",
        sections: [
          {
            sectionId: 1,
            sectionName: "Project",
            sectionType: "FORM",
            isVisible: "Y",
            fields: [
              {
                fieldId: 1,
                description: "Project title",
                isVisible: "Y",
                fieldType: "TEXT",
              },
            ],
          },
        ],
      },
    ];
  if (op === "getProposalEthicaldynFormResponse")
    return [
      {
        form_id: 1,
        sections: [
          {
            section_id: 1,
            fields: [{ field_id: 1, value: "Synthetic research project" }],
          },
        ],
      },
    ];
  if (op === "getSecurityUser_roles")
    return {
      items: [
        {
          page_name: headers.p_obj_id ? "proposals-summary" : "home",
          read_access: "Y",
        },
      ],
    };
  if (op === "getProposalProposal_id") {
    const p = proposals.find(
      (r) => String(r.proposal_id) === pathParams?.proposal_id,
    );
    if (!p) throw new Error("Fixture record not found.");
    return {
      ...p,
      proposal_status: p.proposal_status_code,
      pi_name: p.full_name,
      activity_type_value: p.activity_type_descr,
      proposal_type_value: p.proposal_type_descr,
      cost_model_name: "Example cost model",
      departments: [
        {
          investigator_type_lkp_code: "PI",
          full_name: p.full_name,
          org_unit_name: p.org_unit_name,
          proposal_title: p.proposal_title,
          proposal_description:
            "Synthetic project description for local UI verification.",
        },
      ],
    };
  }
  if (op === "getSharedLabels")
    return [
      "list-investigator",
      "list-applicant-name",
      "list-assigned-to",
      "list-activity-type",
      "list-proposal-type",
      "list-updated-on",
      "list-tags",
      "list-department",
      "list-primary-sponsor",
      "list-created-on",
      "list-start-date",
      "list-end-date",
      "list-total-cost",
      "full-name",
      "org-unit",
      "full-project-title",
      "project-description",
      "activity-type",
      "proposal-type",
      "start-date",
      "end-date",
      "cost-model",
      "currency",
      "assigned-to",
      "tags",
    ].map((label_name) => ({
      module_name: "PROPOSAL",
      label_type: "labels",
      label_name,
      label_value: null,
      is_visible: "Y",
    }));
  if (op === "getPre_awardGetLkpOrgUnitType")
    return {
      items: [
        { org_unit_id: 202, org_unit_name: "Example Research University" },
        { org_unit_id: 203, org_unit_name: "Faculty of Science" },
        { org_unit_id: 204, org_unit_name: "Faculty of Health" },
      ],
    };
  if (op === "getPre_awardGetProposalsList") {
    const q = JSON.parse(query?.get("q") || "{}"),
      offset = Number(query?.get("p_offset") || 0),
      limit = Number(query?.get("p_limit") || 10);
    const rows = proposals.filter((r) => matches(r, q));
    const order = Object.entries(q.$orderby || {})[0];
    if (order) {
      const [key, dir] = order;
      rows.sort(
        (a, b) =>
          String(a[key as keyof typeof a]).localeCompare(
            String(b[key as keyof typeof b]),
            "en",
            { numeric: true },
          ) * (dir === "DESC" ? -1 : 1),
      );
    }
    return {
      items: rows.slice(offset, offset + limit),
      offset,
      size: Math.min(offset + limit, rows.length),
      total_count: rows.length,
    };
  }
  if (op === "getSharedGetOpportunities") {
    let rows = Array.from({ length: 58 }, (_, i) => ({
      opportunities_id: i + 1,
      opp_heading: `Research opportunity ${i + 1}`,
      opportunity_status: "OPEN",
      opp_heading_link: "https://example.org/funding",
      funders: "Example Research Council",
      co_funders: "",
      site: "Fixture source",
      funding_type: i % 2 ? "Grant" : "Fellowship",
      total_fund: 100000 + i * 1000,
      currency_code: "GBP",
      publication_date: "2026-10-01",
      opening_date: "2026-10-05",
      closing_date: "2026-12-01",
      aoi_app_count: 0,
      proposal_count: 0,
      outline_proposal_count: 0,
      summary: "<p>Synthetic opportunity summary.</p>",
      is_bookmarked: i % 2 ? "Y" : "N",
    }));
    const clause = query?.get("p_where_clause") || "";
    if (clause.includes('"is_bookmarked"'))
      rows = rows.filter((r) => r.is_bookmarked === "Y");
    if (clause.includes('"shared_with_me"')) rows = [];
    const search = [...clause.matchAll(/LOWER\('%([^']*)%'\)/g)].map((m) =>
      m[1].toLowerCase(),
    );
    if (search.length)
      rows = rows.filter((r) =>
        search.every((word) => r.opp_heading.toLowerCase().includes(word)),
      );
    const offset = Number(query?.get("p_offset") || 0),
      limit = Number(query?.get("p_limit") || 25);
    return {
      items: rows.slice(offset, offset + limit),
      total_count: rows.length,
      offset,
      hasMore: offset + limit < rows.length,
    };
  }
  if (op === "getDynamicFormsAllRequests") {
    const offset = Number(query?.get("p_offset") || 0),
      limit = Number(query?.get("p_limit") || 25);
    let rows = proposals.map((p, i) => ({
      request_id: p.proposal_id,
      request_number: `EOI_${i + 1}`,
      status: "Draft",
      status_lkp_code: "DRFT",
      opp_heading: p.proposal_title,
      full_name: p.full_name,
      org_unit_name: p.org_unit_name,
      funders: p.primary_sponsorer,
      creation_date: p.creation_date,
      last_update_date: p.last_update_date,
    }));
    const match = query
      ?.get("p_where_clause")
      ?.match(/LOWER\("opp_heading"\) LIKE LOWER\('%([^']*)%'\)/);
    if (match)
      rows = rows.filter((r) =>
        r.opp_heading.toLowerCase().includes(match[1].toLowerCase()),
      );
    return {
      items: rows.slice(offset, offset + limit),
      totalcount: rows.length,
      hasMore: offset + limit < rows.length,
    };
  }
  if (op === "getSharedGetOppStatistics")
    return {
      items: [
        { label: "Grant", value: 12, code: "GRANT" },
        { label: "Fellowship", value: 8, code: "FELLOW" },
      ],
    };
  if (op === "getSharedGetWidgetParameters")
    return [
      {
        widget_name: "DASHBOARD_FEI",
        widget_value: 30000,
        parameters: [
          { param: "FEI_LOW", param_value: 5000000 },
          { param: "FEI_MEDIUM", param_value: 8000000 },
          { param: "FEI_TARGET", param_value: 12000000 },
        ],
      },
    ];
  if (op === "getSharedGetOppCategoryStat")
    return {
      items: [
        { SECTORS: "Health", APPLIED_AMT: 200000, AWARDED_AMT: 140000 },
        { SECTORS: "Education", APPLIED_AMT: 120000, AWARDED_AMT: 80000 },
      ],
    };
  if (op === "getSharedGetTopOppCategoryStat")
    return { items: [{ SECTORS: "Health", NUM_PROP: 12, AMOUNT: 140000 }] };
  if (op === "getSharedGetOppFunnelStat")
    return {
      items: [
        { display_order: 1, label_txt: "Total fund available", amount: 500000 },
        { display_order: 2, label_txt: "Applied amount", amount: 200000 },
        { display_order: 3, label_txt: "Awarded amount", amount: 140000 },
      ],
    };
  if (op === "getPost_awardsAwardVsCostStatistics")
    return {
      items: [
        { label: "2025", seriesid: "Total Amount", value: 200000 },
        { label: "2026", seriesid: "Total Amount", value: 350000 },
        { label: "2025", seriesid: "Award Amount", value: 140000 },
        { label: "2026", seriesid: "Award Amount", value: 220000 },
      ],
    };
  if (
    op === "getProposalGetProposalStatistics" &&
    headers.chart_type === "SCATTER_CHART"
  )
    return {
      items: [
        { RN: 1, x: "P_0001", Y: 120000 },
        { RN: 2, x: "P_0002", Y: 80000 },
      ],
    };
  const w = widgets.find(
    (w) =>
      w.operation === op &&
      (!w.chartType || w.chartType === headers.chart_type),
  );
  if (!w) throw new Error("No fixture for operation.");
  if (w.kind === "statistics")
    return {
      items: [
        { label: headers.year || "2026", code: "Draft", value: 12 },
        { label: headers.year || "2026", code: "Submitted", value: 8 },
        { label: headers.year || "2026", code: "Awarded", value: 5 },
      ],
    };
  const offset = Number(query?.get("offset") || 0),
    org = headers[w.orgHeader];
  const source = proposals.filter(
    (r) =>
      !org ||
      org === "202" ||
      r.org_unit_name ===
        (org === "203" ? "Faculty of Science" : "Faculty of Health"),
  );
  const rows = source.slice(offset, offset + 5).map((p, i) => ({
    ...p,
    deadline_id: i,
    deadline_date: "2026-11-01",
    deadline_type: "SUBMISSION",
    stage_id: 1,
    stage_name: "Research office review",
    contract_id: p.proposal_id,
    contract_number: `CT_${p.proposal_id}`,
    contract_title: p.proposal_title,
    setup_flow_id: p.proposal_id,
    application_number: `ETH_${p.proposal_id}`,
    setup_description: p.proposal_title,
    award_id: p.proposal_id,
    award_number: `AW_${p.proposal_id}`,
    award_name: p.proposal_title,
    request_id: p.proposal_id,
    request_number: `EOI_${p.proposal_id}`,
    opp_heading: p.proposal_title,
  }));
  return { items: rows, hasMore: offset + rows.length < source.length, offset };
}
