import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";
import type { Operation } from "@/server/oracle/connection";
import { fixtureUser, proposals, contracts } from "./fixtures";
import { widgets } from "@/server/modules/home/widgets";
/**
 * Evaluates the p_where_clause grammar that src/server/proposals/where-clause.ts emits:
 * `( atom (AND|OR atom)* )`, atoms `LOWER("c") LIKE LOWER('%v%') ESCAPE '\'`, `"c"='v'`, `"c">='v'`, `"c"<='v'`.
 */
function whereMatcher(
  clause: string,
): (row: Record<string, unknown>) => boolean {
  let i = 0;
  const literal = () => {
    const m = /^'((?:[^']|'')*)'/.exec(clause.slice(i));
    if (!m) throw new Error("Fixture where clause: literal expected.");
    i += m[0].length;
    return m[1].replaceAll("''", "'");
  };
  const atom = (): ((row: Record<string, unknown>) => boolean) => {
    if (clause[i] === "(") return group();
    const like = /^LOWER\("(\w+)"\) LIKE LOWER\(/.exec(clause.slice(i));
    if (like) {
      i += like[0].length;
      const want = literal().slice(1, -1).replace(/\\(.)/g, "$1").toLowerCase();
      i += ") ESCAPE '\\'".length;
      return (row) =>
        String(row[like[1]] ?? "")
          .toLowerCase()
          .includes(want);
    }
    const cmp = /^"(\w+)"(>=|<=|=)/.exec(clause.slice(i));
    if (!cmp) throw new Error("Fixture where clause: atom expected.");
    i += cmp[0].length;
    const want = literal();
    return (row) => {
      // Fixture dates are ISO; compare their calendar-day form with the bound.
      const v = String(row[cmp[1]] ?? "")
        .replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 ")
        .slice(0, want.length);
      return cmp[2] === ">="
        ? v >= want
        : cmp[2] === "<="
          ? v <= want
          : v === want;
    };
  };
  const group = (): ((row: Record<string, unknown>) => boolean) => {
    i += 1;
    const parts = [atom()];
    let any = false;
    for (let m; (m = /^ (AND|OR) /.exec(clause.slice(i)));) {
      i += m[0].length;
      any = m[1] === "OR";
      parts.push(atom());
    }
    i += 1;
    return (row) =>
      any ? parts.some((p) => p(row)) : parts.every((p) => p(row));
  };
  return group();
}
/** Synthetic awards, one per fixture proposal; every fifth has no proposal (so it can be linked to one). */
function awardRows(advanced: boolean) {
  const statuses = [
    ["DRFT", "Draft"],
    ["AIA", "Awaiting Internal Approval"],
    ["IA", "Internally Approved"],
    ["REJ", "Rejected"],
  ];
  return proposals.map((p, i) => ({
    award_id: 5000 + i,
    proposal_id: i % 5 === 4 ? null : p.proposal_id,
    award_number: `AW_${String(i + 1).padStart(4, "0")}`,
    award_name: p.proposal_title,
    award_status_code: statuses[i % statuses.length][0],
    award_status: statuses[i % statuses.length][1],
    proposal_title: p.proposal_title,
    award_start_date: "2026-10-01T00:00:00Z",
    award_end_date: "2027-09-30T00:00:00Z",
    actual_award_date: null,
    creation_date: p.creation_date,
    last_update_date: p.last_update_date,
    sponsor_party_name: p.primary_sponsorer,
    billing_party_name: p.primary_sponsorer,
    org_unit_name: p.org_unit_name,
    award_pi_full_name: p.full_name,
    award_amount: i % 3 === 0 ? null : 10000 * (i + 1),
    ...(advanced
      ? { attribute_1: i % 2 ? "P1" : "P2", amount: 10000 * (i + 1) }
      : {}),
  }));
}
// Simulated writes that answer a body (the record's new id, the saved costing); every other write answers {}.
const WRITE_REPLIES = new Set<Operation>([
  "postProposalProposal",
  "postPre_awards_costingInsertCostingHeaderN",
  "postPre_awards_costingSaveCostingDataN",
  "postCopyClaimApp",
]);
/** A simulated write in fixture mode (the connection's writes gate never opens there). */
export async function mockOracleWrite(
  op: Operation,
  headers: Record<string, string>,
  query?: URLSearchParams,
  pathParams?: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  return WRITE_REPLIES.has(op)
    ? mockOracle(op, headers, query, pathParams, body)
    : {};
}
/** A simulated report file (a 4-byte PDF stub), so download journeys run without Oracle. */
export async function mockOracleFile() {
  if (!fixtureMode())
    throw new Error(
      "Fixture transport cannot run outside explicit development mode.",
    );
  return {
    bytes: new Uint8Array([37, 80, 68, 70]),
    mime: "application/pdf",
    filename: "report.pdf",
  };
}
export async function mockOracle(
  op: Operation,
  headers: Record<string, string>,
  query?: URLSearchParams,
  pathParams?: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  if (!fixtureMode())
    throw new Error(
      "Fixture transport cannot run outside explicit development mode.",
    );
  if (op === "postProposalProposal") {
    const proposal = (body as { proposals?: { main_proposal_id?: number } })
      ?.proposals?.main_proposal_id;
    if (!Number.isSafeInteger(proposal) || !proposal)
      throw new Error("Fixture Proposal identity is missing.");
    return { proposal };
  }
  // The isolated Playwright run can hold one lookup to verify that list results and
  // status navigation render before this filter is ready. Never used by live ORDS.
  if (
    process.env.GRANTSNOW_E2E === "true" &&
    op === "getPre_awardGetLookupTypesCodes" &&
    query?.get("lookupTypeCode") === "CONTRACT_TYPE"
  ) {
    const delay = Number(
      process.env.GRANTSNOW_FIXTURE_DELAY_CONTRACT_LOOKUPS_MS,
    );
    if (Number.isFinite(delay) && delay > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay, 5000)),
      );
  }
  if (
    process.env.GRANTSNOW_E2E === "true" &&
    op === "getPre_awardGetApprovalHistory" &&
    headers.approval_type === "CONTRACT"
  ) {
    const delay = Number(
      process.env.GRANTSNOW_FIXTURE_DELAY_CONTRACT_HISTORY_MS,
    );
    if (Number.isFinite(delay) && delay > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay, 5000)),
      );
  }
  const award = (await import("./award-record")).awardRecordFixture(
    op,
    headers,
  );
  if (award !== undefined) return award;
  const claim = (await import("./claims")).claimsFixture(op, headers, query);
  if (claim !== undefined) return claim;
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
      PROPOSAL_STAGE: [
        ["SINGLE", "Single"],
        ["MULTI", "Multi"],
      ],
      SUB_PROPOSAL_TYPE: [
        ["INTERNAL_DEPT", "Internal Department"],
        ["RES_PARTNER", "Research Partner"],
      ],
      COLLABORATOR_ROLE_TYPE_FLAG: [
        ["PRM", "Primary Provider"],
        ["SEC", "Secondary Provider"],
      ],
      SPONSOR_TYPE_FLAG: [
        ["PRM", "Primary Provider"],
        ["SEC", "Secondary Provider"],
        ["BIL", "Billing Provider"],
        ["INK", "In-Kind"],
      ],
      DEADLINE_TYPE: [
        ["FUNDER", "Funder deadline"],
        ["INST", "Institutional deadline"],
        ["NONE", "None"],
      ],
      FILTER_OPERATOR: [
        ["BETWEEN", "Between"],
        ["GT", "Greater Than"],
        ["LT", "Less Than"],
        ["NULL", "Null"],
        ["NOT_NULL", "Not Null"],
      ],
      CURRENCY_CODES: [
        ["GBP", "Pound Sterling"],
        ["USD", "US Dollar"],
      ],
      COST_CATEGORY_TYPES: [
        ["STAFF", "Staff"],
        ["EQUIP", "Equipment"],
        ["TRAVEL", "Travel"],
      ],
      EOI_STATUS: [
        ["DRFT", "Draft"],
        ["AIA", "Awaiting Internal Approval"],
        ["IA", "Internally Approved"],
        ["REJ", "Rejected"],
        ["AWARD", "Awarded"],
      ],
      AWARD_STATUS: [
        ["DRFT", "Draft"],
        ["AIA", "Awaiting Internal Approval"],
        ["IA", "Internally Approved"],
        ["REJ", "Rejected"],
      ],
      // The approval workflow's Add Stage choices.
      APPROVAL_TYPE: [
        ["APPROVAL", "Approval"],
        ["PEERREVIEW", "Peer Review"],
      ],
      APPR_GRP_DETAIL_TYPE: [
        ["GROUP", "Group"],
        ["INDIVIDUAL", "Individual"],
      ],
      CONTRACT_STATUS: [
        ["DRFT", "Draft"],
        ["AIA", "Awaiting Internal Approval"],
        ["IA", "Internally Approved"],
        ["REJ", "Rejected"],
        ["SUB", "Submitted for Signing"],
        ["SIGNED", "Signed"],
      ],
      CONTRACT_TYPE: [["RESEARCH", "Research Contract"]],
      CTR_DEADLINE_TYPE: [["SIGNING", "Signing deadline"]],
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
        {
          person_id: 101,
          employee_number: "EMP101",
          full_name: "Alex Morgan",
          org_unit_id: 202,
          org_unit_name: "Example Research University",
          is_pi_flag: "true",
          costing_allowed_flag: "Y",
          email_address: "alex.morgan@example.org",
        },
        {
          person_id: 102,
          employee_number: "EMP102",
          full_name: "Sam Taylor",
          org_unit_id: 203,
          org_unit_name: "Faculty of Science",
          is_pi_flag: "true",
          costing_allowed_flag: "Y",
          email_address: "sam.taylor@example.org",
        },
      ],
    };
  if (op === "GetSponsorList")
    return {
      items: [
        {
          sponsor_party_id: 301,
          party_name: "Research Council",
          sponsor_type: "GOV",
        },
        {
          sponsor_party_id: 302,
          party_name: "Health Foundation",
          sponsor_type: "CHARITY",
        },
      ],
    };
  if (op === "getPre_awardGetSponsorTypes")
    return {
      items: [
        { sponsor_type_code: "GOV", sponsor_type_name: "Government" },
        { sponsor_type_code: "CHARITY", sponsor_type_name: "Charity" },
      ],
    };
  if (op === "getOpportunitiesGetOpportunityCategory")
    return { items: [{ category: "Research" }, { category: "Teaching" }] };
  if (op === "getPre_awards_costingGetCostModel")
    return {
      items: [{ costmodel_id: 338, costmodel_name: "Example cost model" }],
    };
  if (op === "getSessionLogout") return { response_msg: "SUCCESS" };
  if (op.startsWith("getSession"))
    return {
      ...fixtureUser,
      token: "fixture-backend-token",
      expiry_datetime: new Date(Date.now() + 3600000).toISOString(),
    };
  if (op === "getSharedPersonStatus") {
    const { fixtureSettings } = await import("./account-store");
    return (
      fixtureSettings("shared/PersonStatus") || {
        status_code: "ACTIVE",
        proxy_users: [],
      }
    );
  }
  if (op === "getSharedUserPreference") {
    const { fixtureSettings } = await import("./account-store");
    const saved = fixtureSettings("shared/UserPreference");
    return {
      items: [
        {
          research_areas: "Medicine",
          favourite_funder: "UKRI",
          research_keywords: "Research",
          ...saved,
        },
      ],
    };
  }
  if (op === "getSharedUserPreferenceLOV")
    return { items: [{ label: "Medicine" }, { label: "Research" }] };
  // Finder funder tree: a site row (value = site) and its funders; UKRI stays for the profile's favourites.
  if (op === "getSharedGetOppFunders")
    return {
      items: [
        {
          value: "UKRI",
          site: "UKRI",
          site_name: "UK Research and Innovation",
        },
        { value: "MRC", site: "UKRI", site_name: "UK Research and Innovation" },
        { value: "Fixture source", site: "Fixture source", site_name: null },
        {
          value: "Example Research Council",
          site: "Fixture source",
          site_name: null,
        },
      ],
    };
  if (op === "getSharedOpportunitiesFilter")
    return {
      items: [
        ["STATUS", "Open", "OPEN"],
        ["STATUS", "Upcoming", "UPCOMING"],
        ["STATUS", "Closed", "CLOSED"],
        ["STATUS", "Open ", "open"],
        ["FUNDING_TYPE", "Grant", "Grant"],
        ["FUNDING_TYPE", "Fellowship", "Fellowship"],
      ].map(([filter_type, label, value]) => ({ filter_type, label, value })),
    };
  if (op === "getSharedGetOppFunderTypes")
    return {
      items: [{ funder_type: "Charity" }, { funder_type: "Government" }],
    };
  // Dev returns one row with no code; the finder drops it.
  if (op === "getSharedGetOppCallCodes")
    return { items: [{ call: "CALL-2026-01" }, { call: null }] };
  if (op === "getSharedDashboardPreferences") {
    const { fixtureSettings } = await import("./account-store");
    const saved = fixtureSettings("shared/dashboardPreferences");
    const defaults = {
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
    return {
      ...defaults,
      ...saved,
      needAttention: saved?.needAttention
        ? Object.fromEntries(
            Object.entries(saved.needAttention as Record<string, boolean>).map(
              ([k, v]) => [k, { isVisible: v }],
            ),
          )
        : defaults.needAttention,
      insights: saved?.insights
        ? Object.fromEntries(
            Object.entries(saved.insights as Record<string, boolean>).map(
              ([k, v]) => [k, { isVisible: v }],
            ),
          )
        : defaults.insights,
      accessibility: saved?.accessibility
        ? Object.fromEntries(
            Object.entries(saved.accessibility as Record<string, string>).map(
              ([k, v]) => [k, { value: Number(v) }],
            ),
          )
        : {},
    };
  }
  if (op === "getPre_award_costingGetGlobalVar")
    return {
      items: [
        { var_key: "DEFAULT_CURRENCY_CODE", var_value: "GBP" },
        { var_key: "DEFAULT_DATE_FORMAT", var_value: "DD-MMM-YYYY" },
        { var_key: "DECIMAL_PLACES_COUNT", var_value: "2" },
        // Dynamic-form files: storage folder, size limit (MB) and allowed types.
        { var_key: "INSTANCE", var_value: "dev" },
        { var_key: "DEFAULT_SIZE_FORMAT", var_value: "4" },
        { var_key: "ALLOWED_EXTENSIONS", var_value: "pdf,docx,txt,png,jpg" },
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
  if (op === "getSharedGetObjectDates")
    return {
      items: [
        { column_name: "creation_date", column_description: "Created On" },
        { column_name: "last_update_date", column_description: "Updated On" },
      ],
    };
  // Shell fixtures: drawer "new" dot, one organisation theme, empty profile links.
  if (op === "getSharedGetOpportunitiesNewFlags")
    return { is_new_preference: "Y", is_new_others: "N" };
  if (op === "getSharedGetCustomTheme")
    return {
      items: [
        {
          legal_id: 1,
          display_name: "Fixture Plum",
          primary_color: "#5b2a5e",
          secondary_color: "#f0cc71",
          background_color: null,
          text_color: null,
          is_dark: "N",
        },
      ],
    };
  if (op === "getSharedDigitalPresence")
    return { items: [{ linkedin: "https://www.linkedin.com/in/fixture" }] };
  if (op === "getNotificationsNotifications") {
    const offset = Number(query?.get("p_offset") || 0);
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
      ]
        .map((tab, i) => ({
          page_id: i + 1,
          page_name: `opportunities-eoi-${tab}`,
          component_type: "PAGE",
          read_access: "Y",
          // Form tabs, Attachments and Delegation are editable on the fixture draft (their writes need edit).
          ...(tab === "application" ||
          tab === "attachments" ||
          tab === "delegation" ||
          tab === "approvals" ||
          tab.startsWith("dynamic-form-")
            ? { edit_access: "Y" }
            : {}),
          ...(tab === "delegation" ? { delete_access: "Y" } : {}),
        }))
        // History's Add Status and Abandon button keys (edit grants them).
        .concat(
          ["history-add-status", "history-abandon-button"].map((key, i) => ({
            page_id: 20 + i,
            page_name: `opportunities-eoi-${key}`,
            component_type: "BUTTON",
            read_access: "Y",
            edit_access: "Y",
          })),
        )
        // The approval workflow's keys: add / delete stage, add approver, change / remove approver.
        .concat(
          [
            "eoi-add-stage",
            "eoi-add-approver",
            "opportunities-eoi-change-approver",
          ].map((key, i) => ({
            page_id: 30 + i,
            page_name: key,
            component_type: "BUTTON",
            read_access: "Y",
            edit_access: "Y",
            delete_access: "Y",
          })),
        ),
    };
  // The EOI record's finalize state: nothing to finalize, nothing locked.
  // Finalize state lives in the labelled EOI writes store; only its created record has a finalizable page.
  if (op === "getSharedFinalizablePages")
    return (await import("./eoi-writes")).fixtureFinalizablePages(
      headers.p_obj_id,
    );
  if (op === "getProposalGetLockedModules")
    return (await import("./eoi-writes")).fixtureLockedModules(
      query?.get("prop_id"),
    );
  if (op === "getProposalGetLockStatus")
    return (await import("./eoi-writes")).fixtureLockStatus(
      headers.prop_id,
      headers.lock_level,
    );
  // Fixture comment thread for any record page: one from a colleague, one of the fixture user's own with a mention.
  if (op === "getProposalComments") {
    const thread = {
      object_id: Number(query?.get("object_id")),
      module: query?.get("module"),
    };
    return {
      items: [
        {
          ...thread,
          comment_id: 1,
          comments: "<p>Please confirm the funder deadline.</p>",
          created_by: 102,
          creation_date: "2026-10-01T09:30:00Z",
          full_name: "Sam Taylor",
        },
        {
          ...thread,
          comment_id: 2,
          comments:
            '<p>Confirmed with <a class="mention oj-link-standalone oj-link-subtle-primary" data-mention="@Sam Taylor" data-person-id="102" data-first-name="Sam Taylor" data-mention-type="person">@Sam Taylor</a>.</p>',
          created_by: fixtureUser.pid,
          creation_date: "2026-10-02T14:05:00Z",
          full_name: fixtureUser.full_name,
        },
      ],
    };
  }
  // Fixture audit trail for any record page, filtered by p_event as the backend does (empty is ALL).
  if (op === "getSharedGetObjectAudits2") {
    const trail = [
      ...(headers.p_obj_type === "CONTRACT"
        ? [
            {
              event: "NEW VERSION CREATED",
              date_time: "2026-10-03T11:00",
              field_values: [
                {
                  field_name: "Contract Version",
                  field_value: "C_1300.pdf",
                  old_value: "C_1299.pdf",
                },
              ],
            },
          ]
        : []),
      {
        event: "UPDATED",
        date_time: "2026-10-02T14:10",
        field_values: [
          { field_name: "Project title", field_value: "New", old_value: "Old" },
        ],
      },
      {
        event: "INSERTED",
        date_time: "2026-10-01T09:00",
        field_values: [
          { field_name: "Project title", field_value: "Old", old_value: null },
        ],
      },
    ].map((a) => ({
      ...a,
      object_type: headers.p_obj_type,
      object_id: Number(headers.p_obj_id),
      page_name: headers.p_page_name,
      name: fixtureUser.full_name,
    }));
    return {
      items: headers.p_event
        ? trail.filter((a) => a.event === headers.p_event)
        : trail,
    };
  }
  // Object attributes (shape as services/apps/examples/getSharedGetObjectAttributes): a dependent LOV pair, a
  // required text with a regex, a number, a date, rich text, a read-only text and a hidden field.
  if (op === "getSharedGetObjectAttributes")
    return {
      fields: [
        {
          fieldId: 1,
          description: "Attribute 1",
          fieldType: "LOV",
          isVisible: "Y",
          isRequired: "Y",
          colspan: 6,
          attributeName: "attribute_1",
          helperText: "<p>Choose the programme.</p>",
          options: ["P1", "P2"].map((v) => ({ optionId: v, optionValue: v })),
        },
        {
          fieldId: 2,
          description: "Attribute 2",
          fieldType: "LOV",
          isVisible: "Y",
          isRequired: "N",
          colspan: 6,
          attributeName: "attribute_2",
          parent_header_attr: "attribute_1",
          options: [
            ["SP1", "P1"],
            ["SP2", "P1"],
            ["SP3", "P2"],
          ].map(([v, p]) => ({
            optionId: v,
            optionValue: v,
            parent_lkp_code: p,
          })),
        },
        {
          fieldId: 3,
          description: "Reference code",
          fieldType: "TEXTBOX",
          isVisible: "Y",
          isRequired: "Y",
          colspan: 4,
          attributeName: "attribute_3",
          regexValidation: "[A-Z]{2}\\d{3}",
          regexDesc: "Two capitals and three digits, e.g. AB123",
        },
        {
          fieldId: 4,
          description: "Amount",
          fieldType: "NUMERIC",
          isVisible: "Y",
          isRequired: "N",
          colspan: 4,
          attributeName: "attribute_4",
        },
        {
          fieldId: 5,
          description: "Review date",
          fieldType: "DATE",
          isVisible: "Y",
          isRequired: "N",
          colspan: 4,
          attributeName: "attribute_5",
        },
        {
          fieldId: 6,
          description: "Notes",
          fieldType: "RICHTEXTEDITOR",
          isVisible: "Y",
          isRequired: "N",
          colspan: 12,
          attributeName: "attribute_6",
        },
        {
          fieldId: 7,
          description: "Set by the office",
          fieldType: "TEXTBOX",
          isVisible: "Y",
          isRequired: "N",
          isReadonly: "Y",
          colspan: 6,
          attributeName: "attribute_7",
        },
        {
          fieldId: 8,
          description: "Hidden",
          fieldType: "TEXTBOX",
          isVisible: "N",
          isRequired: "Y",
          colspan: 6,
          attributeName: "attribute_8",
        },
      ],
    };
  if (op === "getDynamicFormsGetRequestDetails") {
    const id = Number(headers.request_id);
    return {
      items: [
        {
          request_id: id,
          request_number: `EOI_${id - 999}`,
          request_type: "OPPORTUNITIES-EOI",
          // EOI_2 is in approval (as the list shows it), so its Workflow tab can approve and withdraw.
          ...(id === 1001
            ? { status: "Awaiting Internal Approval", status_code: "AIA" }
            : { status: "Draft", status_code: "DRFT" }),
          creation_date: "2026-10-01",
          ref_object_id: 1,
          ref_object_type: "OPPORTUNITIES",
        },
      ],
    };
  }
  // Form file fields list by secondary type, the Attachments tab by object; the in-memory fixture table holds both.
  if (op === "getPre_awardAttachmentsProposal_id")
    return (await import("./attachments")).fixtureAttachments(query);
  if (op === "getPre_awardLinks")
    return (await import("./attachments")).fixtureLinks(query);
  // The EOI record's History and Delegation panels (shapes as getSharedObjectStatus / GetSharedDelegations).
  if (
    op === "getSharedObjectStatus" &&
    headers.p_obj_type === "OPPORTUNITIES-EOI"
  )
    return {
      items: [
        {
          object_status_lkp_code: "DRFT",
          object_status: "Draft",
          status_process_mode_lkp_code: "AUTO",
          status_process_mode: "Auto",
          comments: "Application created from the opportunity finder",
          created_by: 101,
          created_by_name: "Alex Morgan",
          creation_date: "2026-10-01T09:30:00",
        },
      ],
    };
  if (op === "getSharedGetNextObjectStatus")
    return {
      items: [{ STATUS: "Awaiting Internal Approval", STATUS_CODE: "AIA" }],
    };
  if (op === "getPre_awardGetApprovalHistory")
    return (await import("./approvals")).fixtureApprovals(op, headers, query);
  if (
    op === "getProposalDelegationsProposal_id" &&
    headers.object_type === "OPPORTUNITIES-EOI"
  )
    return {
      items: ["summary", "history"].map((tab, i) => ({
        id: 501 + i,
        pid: 102,
        object_id: Number(headers.object_id),
        page_id: i === 0 ? 1 : 6,
        page_name: `opportunities-eoi-${tab}`,
        page_desc: tab === "summary" ? "Summary" : "History",
        component_type: "PAGE",
        read_access: "Y",
        edit_access: i === 0 ? "N" : "Y",
        delete_access: "N",
        start_date: "2026-10-01T00:00:00Z",
        end_date: null,
      })),
    };
  if (
    op === "getApproval_setupApproval_stages" ||
    op === "getApproval_setupApproval_stages_graph" ||
    op === "getApproval_setupGet_stage_users" ||
    op === "getApproval_groupApproval_group_m"
  )
    return (await import("./approvals")).fixtureApprovals(op, headers, query);
  if (
    op === "getProposalDelegationsProposal_id" ||
    op === "getSharedObjectStatus"
  )
    return op === "getSharedObjectStatus" &&
      headers.p_obj_type === "CONTRACT" &&
      headers.p_obj_id === "1301"
      ? {
          items: [
            {
              object_id: 1301,
              object_status: "Internally Approved",
              status_process_mode: "AUTO",
              created_by_name: "Alex Morgan",
              creation_date: "2026-10-13T17:35:15Z",
            },
            {
              object_id: 1301,
              object_status: "Awaiting Internal Approval",
              status_process_mode: "AUTO",
              created_by_name: "Alex Morgan",
              creation_date: "2026-10-13T17:34:57Z",
            },
            {
              object_id: 1301,
              object_status: "Draft",
              status_process_mode: "AUTO",
              comments: "Contract Created",
              created_by_name: "Alex Morgan",
              creation_date: "2026-10-13T17:33:37Z",
            },
          ],
        }
      : { items: [] };
  if (op === "getContractsSignerDetails")
    return headers.contract_id === "1301"
      ? {
          items: [
            {
              contract_id: 1301,
              signer_name: "Sam Taylor",
              signer_email: "sam.taylor@example.org",
              user_type: "Internal User",
              sentdatetime: "2026-10-13T17:35:43Z",
            },
          ],
        }
      : { items: [] };
  // Dynamic forms (shapes as GN-Angular's specs and GrantsNow-Dynamic-Forms.md): conditions, dependent fields and
  // LOVs, every field type, an optional section, a GRID and a FILE field.
  if (op === "getProposalEthical_dynFormsP_ref_module") {
    if (
      headers.p_obj_type === "CONTRACT" &&
      headers.p_obj_id &&
      headers.p_ref_module !== "CONTRACTS-SUMMARY"
    )
      return [];
    const f = (
      fieldId: number,
      description: string,
      fieldType: string,
      more: Record<string, unknown> = {},
    ) => ({
      fieldId,
      description,
      fieldType,
      isRequired: "N",
      isVisible: "Y",
      colspan: 6,
      ...more,
    });
    if (headers.p_ref_module === "CONTRACTS-SUMMARY")
      return [
        {
          formId: 7,
          formName: "Test",
          sections: [
            {
              sectionId: 71,
              sectionName: "Test",
              isVisible: "Y",
              fields: [
                f(1, "Testing Text box", "TEXTBOX"),
                f(2, "LOV Test", "LOV", {
                  isRequired: "Y",
                  options: [{ optionId: 1, optionValue: "Option one" }],
                }),
              ],
            },
          ],
        },
      ];
    return [
      {
        formId: 1,
        formName: "Research application",
        sections: [
          {
            sectionId: 1,
            sectionName: "Project",
            sectionType: "FORM",
            colspan: 12,
            maxColumns: 2,
            isVisible: "Y",
            isMandatory: "Y",
            helperText: "&lt;p&gt;Tell us about the project.&lt;&#x2F;p&gt;",
            fields: [
              f(1, "Project title", "TEXTBOX", {
                isRequired: "Y",
                helperText:
                  "&lt;p&gt;As on the funder&#39;s form.&lt;&#x2F;p&gt;",
              }),
              f(2, "Project code", "TEXTBOX", {
                regexValidation: "[A-Z]{3}-\\d{3}",
              }),
              f(3, "Amount", "NUMERIC", { isRequired: "Y" }),
              f(4, "Start date", "DATE"),
              f(5, "Ethics approval needed", "RADIO", {
                options: [
                  { optionId: 51, optionValue: "Yes", dependent_fields: "6" },
                  { optionId: 52, optionValue: "No" },
                ],
              }),
              f(6, "Ethics details", "TEXTFIELD", {
                isVisible: "C",
                isRequired: "Y",
              }),
              f(7, "Themes", "CHECKBOX", {
                options: [
                  { optionId: 71, optionValue: "Health" },
                  { optionId: 72, optionValue: "Climate" },
                ],
              }),
              f(8, "Country", "LOV", {
                options: [
                  { optionId: 81, optionValue: "United Kingdom" },
                  { optionId: 82, optionValue: "France" },
                ],
              }),
              f(9, "City", "LOV", {
                parent_header_attr: 8,
                options: [
                  { optionId: 91, optionValue: "Leeds", parent_lkp_code: "81" },
                  { optionId: 92, optionValue: "Paris", parent_lkp_code: "82" },
                ],
              }),
              f(10, "Supporting document", "FILE"),
              f(11, "Summary", "RICHTEXTEDITOR", {
                colspan: 12,
                regexValidation: "[\\s\\S]{0,400}",
                regexDesc:
                  "Use less than 400 characters (including formatting)",
              }),
            ],
          },
          {
            sectionId: 2,
            sectionName: "Budget lines",
            sectionType: "GRID",
            colspan: 12,
            isVisible: "Y",
            isMandatory: "N",
            fields: [
              f(21, "Item", "TEXTBOX", { isRequired: "Y" }),
              f(22, "Cost", "NUMERIC"),
            ],
          },
          {
            sectionId: 3,
            sectionName: "Partners",
            sectionType: "FORM",
            colspan: 12,
            maxColumns: 2,
            isVisible: "Y",
            isMandatory: "N",
            fields: [
              f(31, "Partner organisations", "COMBOBOXMANY", {
                options: [
                  { optionId: 311, optionValue: "University of Leeds" },
                  { optionId: 312, optionValue: "Sorbonne" },
                ],
              }),
            ],
          },
        ],
      },
    ];
  }
  if (
    op === "getProposalEthicaldynFormResponse" &&
    headers.P_REF_MODULE === "CONTRACTS-SUMMARY"
  )
    return [
      {
        form_id: 7,
        sections: [
          {
            section_id: 71,
            fields: [
              { field_id: 1, value: "Synthetic contract note" },
              { field_id: 2, value: "1" },
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
            fields: [
              { field_id: 1, value: "Synthetic research project" },
              { field_id: 3, value: "1250.5" },
              { field_id: 5, value: "52" },
              { field_id: 7, value: "71~~72" },
              {
                field_id: 11,
                value: "<p><strong>Synthetic</strong> summary.</p>",
              },
            ],
          },
          {
            section_id: 2,
            fields: [
              { field_id: 21, value: "Travel~~Equipment" },
              { field_id: 22, value: "300~~" },
            ],
          },
        ],
      },
    ];
  // Card actions read the dashboard grants (opportunity-notes, apply / convert).
  if (op === "getSecurityUser_roles" && headers.p_obj_type === "DASHBOARD")
    return {
      items: [
        { page_name: "home", read_access: "Y" },
        { page_name: "create-contract", read_access: "Y" },
        ...[
          "create-claims-unit",
          "edit-claims-unit",
          "claims-clone",
          "claims-export",
        ].map((page_name) => ({ page_name, read_access: "Y" })),
        ...[
          "opportunity-notes",
          "apply-opportunities",
          "convert-opportunity",
          "convert-opportunity-to-proposal",
        ].map((page_name) => ({
          page_name,
          read_access: "Y",
          edit_access: "Y",
        })),
      ],
    };
  if (op === "getNotificationsGetGroupsAndRoles")
    return {
      items:
        headers.p_share_to === "ROLE"
          ? [{ value: "RESEARCH_OFFICER", description: "Research Officer" }]
          : [{ value: "GRANTS_TEAM", description: "Grants Team" }],
    };
  if (op === "getPre_awardGetPersonListAll")
    return {
      items: [
        {
          person_id: 101,
          org_unit_id: 202,
          full_name: "Alex Morgan",
          org_unit_name: "Example Research University",
          employee_number: "EMP101",
        },
        {
          person_id: 102,
          org_unit_id: 203,
          full_name: "Sam Taylor",
          org_unit_name: "Faculty of Science",
          employee_number: "EMP102",
        },
      ],
    };
  if (op === "getPre_awardGetCollaboratorList")
    return {
      items: [
        {
          id: 252,
          collaborator_name: "Lancaster University",
          collaborator_code: "LANCUNI",
        },
        {
          id: 255,
          collaborator_name: "University College London",
          collaborator_code: "UCL",
        },
      ],
    };
  // A proposal's roles: the summary, plus FX rates editable from its Budget and Pricing tabs.
  if (
    op === "getSecurityUser_roles" &&
    headers.p_obj_id &&
    headers.p_obj_type?.endsWith("PROPOSAL")
  )
    return {
      items: [
        {
          page_id: 1,
          page_name: "proposals-summary",
          read_access: "Y",
          edit_access: "Y",
          delete_access: "Y",
        },
        {
          page_id: 2,
          page_name: "proposals-edit-pi",
          read_access: "Y",
          edit_access: "Y",
        },
        ...[
          "proposals-dynamic-form-1",
          "proposals-approvals",
          "proposals-history",
          "proposals-attachments",
          "proposals-delegation",
          "proposals-contracts",
        ].map((page_name, i) => ({
          page_id: 50 + i,
          page_name,
          read_access: "Y",
          edit_access: "N",
        })),
        ...[
          "proposals-budget",
          "proposals-pricing",
          "proposal-fx-rates",
          "proposals-fec-summary",
        ].map((page_name, i) => ({
          page_id: 40 + i,
          page_name,
          read_access: "Y",
          edit_access: "Y",
        })),
        ...[
          "proposals-budget-staff",
          "proposals-budget-student",
          "proposals-budget-pool-tech",
          "proposals-budget-non-staff",
          "proposals-budget-collab",
          "quick-costing",
        ].map((page_name, i) => ({
          page_id: 60 + i,
          page_name,
          read_access: "Y",
          edit_access: "Y",
        })),
      ],
    };
  // FX rates of any proposal version (shape as legacy fx-rates-fragment.json fxRatesData).
  if (op === "getProposalFxRates")
    return {
      can_edit: "Y",
      is_active_version: "Y",
      proposal_id: Number(headers.proposal_id),
      proposal_period_version_id: Number(headers.version_id),
      fx_rates: [
        ["USD", "US Dollars", 1.34, 1.3, "OVERRIDDEN"],
        ["EUR", "Euros", 1.17, 1.17, "ADMIN_DEFAULT"],
        ["NZD", "New Zealand Dollars", 2.26, 2.26, "ADMIN_DEFAULT"],
      ].map(([code, name, rate, base, status], i) => ({
        proposal_fx_rate_id: 900 + i,
        currency_code: code,
        currency_name: name,
        costing_fx_rate: rate,
        pricing_fx_rate: base,
        default_costing_fx_rate: base,
        default_pricing_fx_rate: base,
        rate_status: status,
      })),
    };
  if (op === "getPre_awards_costingBudget_version")
    return {
      items: [{ proposal_period_version_id: 12113, version: "Version 1" }],
    };
  if (op === "getPre_awards_costingGetFundingHdr")
    return {
      items: [
        { lookup_code: "DA", lookup_code_value: "Directly Allocated" },
        { lookup_code: "DC", lookup_code_value: "Direct Cost" },
      ],
    };
  if (op === "getPre_awardGetProjectRoles")
    return {
      items: [
        {
          project_role_code: "PI",
          project_role_name: "Principal investigator",
        },
        { project_role_code: "STUD", project_role_name: "Student" },
        {
          project_role_code: "POOL_TECH",
          project_role_name: "Pool technician",
        },
      ],
    };
  if (op === "getPre_awards_costingGetCostItem")
    return {
      items: [
        {
          cost_category_type_lkp_code: "EQUIP",
          cost_item_lkp_code: "EQUIPMENT",
          cost_item_desc: "Equipment",
        },
        {
          cost_category_type_lkp_code: "TRAVEL",
          cost_item_lkp_code: "TRAVEL",
          cost_item_desc: "Travel",
        },
      ],
    };
  if (op === "postInsertCostingBulk") return { status: "success" };
  if (op === "postPre_awards_costingInsertCostingHeaderN")
    return {
      costing_line_json: [
        {
          costing_header_id: 80001,
          costing_line_id: 80002,
          costmodel_id: "338",
        },
      ],
      cost_summary: [],
    };
  if (op === "postPre_awards_costingSaveCostingDataN")
    return { costing_line_json: [] };
  if (op === "getPre_awards_costingGetCostSummary")
    return {
      items:
        query?.get("pid") === "1001"
          ? [
              {
                proposal_id: 1001,
                proposal_number: "P_0002",
                costing_header_id: 57993,
                funding_header: 1,
                funding_header_description: "Directly Allocated",
                cost_category_lkp_code: "STAFF",
                cost_category_type_value: "Staff",
                staff_name: "Alex Morgan",
                project_role: "Principal investigator",
                fte: 0.5,
                avg_fte: 0.5,
                project_hours: 800,
                project_months: 12,
                unindex_cost: 1000,
                fec_cost: 1200,
              },
              {
                proposal_id: 1001,
                proposal_number: "P_0002",
                collab_id: 42,
                collab_name: "Lancaster University",
                costing_header_id: 57994,
                funding_header: 2,
                funding_header_description: "Direct Cost",
                cost_category_lkp_code: "EQUIP",
                cost_category_type_value: "Equipment",
                staff_name: "Travel",
                project_role: "Research partner",
                fte: 0,
                avg_fte: 0,
                project_hours: 0,
                project_months: 0,
                unindex_cost: 10,
                fec_cost: 10.73,
                cost_year_splits: [
                  {
                    period_label: "2026/27",
                    unindexed_cost: 10,
                    indexed_cost: 10.73,
                  },
                ],
              },
            ]
          : [],
    };
  if (op === "getSharedGetCustomerReport2")
    return {
      data: [
        {
          Metric: "Budget coverage",
          Value: "Complete",
          internal_note: "DO-NOT-EXPOSE",
        },
      ],
    };
  if (op === "getContractsGetRelationType")
    return {
      items: [
        { object_type: "AWARD", object_desc: "Award" },
        { object_type: "PROJECT", object_desc: "Project" },
        { object_type: "PROPOSAL", object_desc: "Proposal" },
      ],
    };
  // Contracts' relation lookup; the awards dialogs (object_status AWARD) have their own fixture below.
  if (op === "getContractsGetRelationItem" && headers.object_status !== "AWARD")
    return {
      items: [
        {
          object_id: 6718,
          object_number: "P_6718",
          object_title: "Example proposal",
        },
      ],
    };
  if (op === "getContractsGetContractTemplateName")
    return {
      items: [
        {
          template_id: 1,
          file_name: "Standard contract template.docx",
          legal_id: 1,
        },
      ],
      count: 1,
    };
  if (op === "getGetPlaceholderTags")
    return {
      items: [
        {
          column_name: "CONTRACT_NUMBER",
          column_tag: "{CONTRACT_NUMBER}",
          description: null,
        },
        {
          column_name: "CONTRACT_TITLE",
          column_tag: "{CONTRACT_TITLE}",
          description: null,
        },
      ],
    };
  if (op === "getSecurityUser_roles")
    return {
      items: [
        {
          page_name: headers.p_obj_id
            ? headers.p_obj_type === "CONTRACT"
              ? "contracts-summary"
              : "proposals-summary"
            : "home",
          read_access: "Y",
        },
        ...(headers.p_obj_type === "CONTRACT" && headers.p_obj_id
          ? [
              { page_name: "contracts-history", read_access: "Y" },
              { page_name: "contracts-workflow", read_access: "Y" },
              {
                page_name: "contracts-delegation",
                read_access: "Y",
                edit_access: "Y",
                delete_access: "Y",
              },
              { page_name: "contracts-signers", read_access: "Y" },
              {
                page_name: "contract-add-status",
                read_access: "Y",
                edit_access: "Y",
              },
            ]
          : []),
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
      cost_model: 338,
      cost_model_name: "Example cost model",
      currency_code: "GBP",
      sponsors:
        p.proposal_id === 1000
          ? [
              {
                prop_sponsors_rltn_id: 701,
                sponsor_party_id: 301,
                party_name: "Research Council",
                funder_type: "Government",
                sponsor_type: "Primary Provider",
                sponsor_type_flag_lkp_code: "PRM",
                sponsor_priority: 1,
              },
            ]
          : [],
      proposal_period_version_id:
        p.proposal_id === 1000 || p.proposal_id === 1001 ? 12113 : null,
      departments: [
        {
          investigator_type_lkp_code: "PI",
          person_id: 101,
          employee_number: "EMP101",
          org_unit_id: 202,
          full_name: p.full_name,
          org_unit_name: p.org_unit_name,
          proposal_title: p.proposal_title,
          proposal_description:
            "Synthetic project description for local UI verification.",
        },
      ],
    };
  }
  if (op === "getContractsContract_id") {
    const record = contracts.find(
      (r) => String(r.contract_id) === pathParams?.contract_id,
    );
    if (!record) throw new Error("Fixture contract not found.");
    return record;
  }
  if (op === "getGetAllContracts") {
    const where = query?.get("p_where_clause");
    const offset = Number(query?.get("p_offset") || 0);
    const limit = Number(query?.get("p_limit") || 10);
    const rows = contracts.filter(
      (r) =>
        (!headers.p_status || r.status_lkp_code === headers.p_status) &&
        (!headers.p_level ||
          headers.p_level.split(",").includes(r.contract_level)) &&
        (!headers.p_object_ref_id ||
          r.object_ref_id === headers.p_object_ref_id) &&
        (!where || whereMatcher(where)(r)),
    );
    const sort = query?.get("p_order_by")?.replaceAll('"', "");
    const direction = query?.get("p_sort_order") === "DESC" ? -1 : 1;
    if (sort)
      rows.sort(
        (a, b) =>
          String(a[sort as keyof typeof a] ?? "").localeCompare(
            String(b[sort as keyof typeof b] ?? ""),
            "en",
            { numeric: true },
          ) * direction,
      );
    return {
      items: rows.slice(offset, offset + limit),
      offset,
      total_count: rows.length,
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
    ]
      .map((label_name) => ({
        module_name: "PROPOSAL",
        label_type: "labels",
        label_name,
        label_value: null,
        is_visible: "Y",
      }))
      .concat(
        [
          "units-listing-unitId",
          "units-listing-fiscalYear",
          "units-listing-fundType",
          "listing-unit-id",
          "grant-value-id",
          "payment-account-code",
        ].map((label_name) => ({
          module_name: "CLAIMS",
          label_type: "labels",
          label_name,
          label_value: null,
          is_visible: "Y",
        })),
      );
  if (op === "getPre_awardGetLkpOrgUnitType")
    return {
      items: [
        {
          org_unit_id: 202,
          org_unit_name: "Example Research University",
          NUM_SPACES: 0,
        },
        {
          org_unit_id: 203,
          org_unit_name: "Faculty of Science",
          NUM_SPACES: 2,
        },
        { org_unit_id: 204, org_unit_name: "Faculty of Health", NUM_SPACES: 2 },
      ],
    };
  // Fixture user may open Ethics rows (legacy checkApplApprAccess).
  if (op === "getDynamicFormsCheckApplApprAccess") return { hasAccess: "Y" };
  if (op === "getPre_awardGetProposalsList") {
    const where = query?.get("p_where_clause"),
      offset = Number(query?.get("p_offset") || 0),
      limit = Number(query?.get("p_limit") || 10);
    const rows = where ? proposals.filter(whereMatcher(where)) : [...proposals];
    const key = query?.get("p_order_by")?.replaceAll('"', ""),
      dir = query?.get("p_sort_order");
    if (key) {
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
      high_award_range: 50000,
      funder_type: i % 3 ? "Government" : "Charity",
      programme: "Fixture programme",
      call: "CALL-2026-01",
      deadline_date: i === 0 ? "2026-11-15, 2026-12-01" : null,
      currency_code: "GBP",
      publication_date: "2026-10-01",
      opening_date: "2026-10-05",
      closing_date: "2026-12-01",
      aoi_app_count: 0,
      proposal_count: 0,
      outline_proposal_count: 0,
      summary: "<p>Synthetic opportunity summary.</p>",
      is_bookmarked: i % 2 ? "Y" : "N",
      is_new: i < 3 ? "Y" : "N",
      closing_soon: i === 1 ? "Y" : "N",
      notes: i === 0 ? "<p>Synthetic <strong>note</strong>.</p>" : null,
      create_application_of_interest: "Y",
      create_outline_application: "Y",
      create_grant_application: "Y",
    }));
    const clause = query?.get("p_where_clause") || "";
    if (clause.includes('"is_bookmarked"'))
      rows = rows.filter((r) => r.is_bookmarked === "Y");
    if (clause.includes('"shared_with_me"')) rows = [];
    const byId = clause.match(/"opportunities_id"='(\d+)'/)?.[1];
    if (byId) rows = rows.filter((r) => String(r.opportunities_id) === byId);
    // Title words, funding types and funder types as the finder's where clause sends them.
    const like = (column: string) =>
      [
        ...clause.matchAll(
          new RegExp(`LOWER\\("${column}"\\) LIKE LOWER\\('%([^']*)%'\\)`, "g"),
        ),
      ].map((m) =>
        m[1].replaceAll("''", "'").replace(/\\(.)/g, "$1").toLowerCase(),
      );
    const search = like("opp_heading");
    if (search.length)
      rows = rows.filter((r) =>
        search.every((word) => r.opp_heading.toLowerCase().includes(word)),
      );
    const fundingTypes = like("funding_type");
    if (fundingTypes.length)
      rows = rows.filter((r) =>
        fundingTypes.some((t) => r.funding_type.toLowerCase().includes(t)),
      );
    const funderType = clause.match(/"funder_type"='([^']*)'/)?.[1];
    if (funderType) rows = rows.filter((r) => r.funder_type === funderType);
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
    // Synthetic EOI requests: statuses cycle through the EOI_STATUS fixture; funder text keeps a parenthesised comma.
    const statuses = [
      ["DRFT", "Draft"],
      ["AIA", "Awaiting Internal Approval"],
      ["IA", "Internally Approved"],
      ["REJ", "Rejected"],
      ["AWARD", "Awarded"],
    ];
    let rows = proposals.map((p, i) => ({
      request_id: p.proposal_id,
      request_number: `EOI_${i + 1}`,
      status: statuses[i % statuses.length][1],
      status_lkp_code: statuses[i % statuses.length][0],
      opp_heading: p.proposal_title,
      full_name: p.full_name,
      org_unit_name: p.org_unit_name,
      funders:
        i % 3 === 0
          ? `${p.primary_sponsorer}, UKRI (MRC, EPSRC)`
          : p.primary_sponsorer,
      creation_date: p.creation_date,
      last_update_date: p.last_update_date,
      logo: null,
    }));
    const where = query?.get("p_where_clause");
    if (where) rows = rows.filter(whereMatcher(where));
    const order = query?.get("p_order_by")?.match(/^"(\w+)"$/)?.[1];
    if (order) {
      const dir = query?.get("p_sort_order") === "ASC" ? 1 : -1;
      rows.sort(
        (a, b) =>
          dir *
          String(a[order as keyof (typeof rows)[number]] ?? "").localeCompare(
            String(b[order as keyof (typeof rows)[number]] ?? ""),
          ),
      );
    }
    return {
      items: rows.slice(offset, offset + limit),
      totalcount: rows.length,
      hasMore: offset + limit < rows.length,
    };
  }
  if (
    op === "getPost_awardsAwardHeader" ||
    op === "getPost_awardsAdvancedSearch"
  ) {
    const offset = Number(query?.get("p_offset") || 0),
      limit = Number(query?.get("p_limit") || 25);
    let rows = awardRows(op === "getPost_awardsAdvancedSearch");
    const where = query?.get("p_where_clause");
    if (where) rows = rows.filter(whereMatcher(where));
    return {
      items: rows.slice(offset, offset + limit),
      total_count: rows.length,
      hasMore: String(offset + limit < rows.length),
    };
  }
  // Awards listing dialogs: proposals open for an award, clone parts, a proposal's awards, linked records.
  if (op === "getContractsGetRelationItem")
    return {
      items: proposals.slice(0, 5).map((p) => ({
        object_id: p.proposal_id,
        object_number: p.proposal_number,
        object_title: p.proposal_title,
      })),
    };
  if (op === "getPost_awardsAwardhierarchy")
    return { count: Number(headers.proposal_id) % 2 === 0 ? 1 : 0, items: [] };
  if (op === "getPost_awardsCopyAwardObjList")
    return {
      items: [
        {
          r: "award-header",
          d: "Award Header",
          parent_object: null,
          default_value: true,
        },
        {
          r: "award-projects",
          d: "Projects",
          parent_object: null,
          default_value: false,
        },
        {
          r: "award-project-team",
          d: "Project Team",
          parent_object: "award-projects",
          default_value: false,
        },
        {
          r: "award-attachments",
          d: "Attachments",
          parent_object: null,
          default_value: false,
        },
      ],
    };
  if (op === "getSharedObjectLinked2")
    return {
      ObjectLinks:
        Number(headers.object_id) % 5 === 4
          ? null
          : [
              {
                MODULE_NAME: "PROPOSAL",
                OBJECT_ID: 1000,
                OBJECT_NAME: "P_0001",
                OBJECT_STATUS: "Draft",
                OBJECT_TITLE: "Climate resilient communities — study 1",
                LAST_UPDATED_BY: "Alex Morgan",
                LAST_UPDATE_DATE: "2026-10-10",
                OBJECT_LINK:
                  "https://vbcs.example/app/?mode=view&proposal_id=1000&proposal_type=PROPOSAL&page=shell&shell=proposals&proposals=proposals-info-start",
              },
              {
                MODULE_NAME: "AWARD",
                OBJECT_ID: Number(headers.object_id),
                OBJECT_NAME: "itself",
              },
            ],
    };
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
  // Synthetic statistics per chart_type, carrying the drill codes the legacy rows carry.
  const status = [
    { label: "Draft", code: "DRFT", value: 12 },
    { label: "Submitted", code: "SUB", value: 8 },
    { label: "Awarded", code: "AWARD", value: 5 },
  ];
  const faculties = [
    { label: "Faculty of Science", code: "203", value: 9 },
    { label: "Faculty of Health", code: "204", value: 6 },
  ];
  const statistics: Record<string, Record<string, unknown>[]> = {
    PROP_STATUS: status,
    AWARD_STATUS: status,
    ETHICS_STATUS: status,
    PROP_FACULTY: faculties,
    ETHICS_ORG: faculties,
    AWARD_FACULTY: faculties.map(({ label, value }) => ({ label, value })),
    ETHICS_RISK: [
      { label: "Low", code: "LOW", value: 7 },
      { label: "High", code: "HIGH", value: 2 },
    ],
    YEAR_STATUS: status.map((s) => ({
      label: headers.year?.split(",")[0] || "2026",
      code: s.label,
      status_code: s.code,
      value: s.value,
    })),
  };
  if (headers.chart_type && statistics[headers.chart_type])
    return { items: statistics[headers.chart_type] };
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
  const offset = Number(query?.get("p_offset") || 0),
    limit = Number(query?.get("p_limit") || 25),
    org = headers[w.orgHeader];
  const source = proposals.filter(
    (r) =>
      !org ||
      org === "202" ||
      r.org_unit_name ===
        (org === "203" ? "Faculty of Science" : "Faculty of Health"),
  );
  const rows = source.slice(offset, offset + limit).map((p, i) => ({
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
