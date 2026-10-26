import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
type Rights = { read: boolean; edit: boolean; delete: boolean };
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  reference: vi.fn(),
  roles: new Map<string, Rights>(),
  status: "DRFT",
  username: "alex.morgan@example.org" as string | undefined,
  locked: false,
  labels: null as unknown[] | null,
  forget: vi.fn(),
}));
vi.mock("@/server/modules/opportunities/record", () => ({
  eoiRecordRead: async () => ({
    id: "12",
    session: { token: "isolated-token", username: state.username },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: {},
    },
    request: { request_number: "EOI_12", status_code: state.status },
    access: { roles: state.roles, pages: [] },
  }),
  eoiPageLock: async () => ({ known: true, locked: state.locked }),
}));
// Reference reads (people, groups, lookups) answer from `state.reference`, record reads from `state.oracle`.
const REFERENCE = [
  "getPre_awardGetPersonList",
  "getApproval_groupApproval_group_m",
  "getPre_awardGetLookupTypesCodes",
];
vi.mock("@/server/oracle/connection", () => ({
  oracle: (op: string, ...rest: unknown[]) =>
    (REFERENCE.includes(op) ? state.reference : state.oracle)(op, ...rest),
  oracleWrite: state.oracleWrite,
}));
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({
    token: "isolated-token",
    identity: { legal_id: "77", org_id: "202", user_id: "101" },
  }),
}));
vi.mock("@/server/oracle/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/oracle/cache")>()),
  forgetOperation: state.forget,
}));
vi.mock("@/server/platform/configuration/formatting", () => ({
  displayFormat: async () => ({ dateFormat: "DD-MMM-YYYY" }),
}));
vi.mock("@/server/platform/configuration/resources", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/platform/configuration/resources")
    >();
  return {
    ...actual,
    // The seeds as the backend would merge them; a test may replace them.
    resources: async () => state.labels ?? actual.mergeResourceDefaults([]),
  };
});
import { GET, POST } from "@/app/api/opportunities/eoi/[id]/workflow/route";
// The client also passes its optional signal / query / path arguments; assertions compare the leading ones.
const lead = (mock: { mock: { calls: unknown[][] } }, n = 3) =>
  mock.mock.calls.map((c) => c.slice(0, n));
import { workflowView } from "@/server/record/approvals/workflow";
import { eoiApprovalHost } from "@/server/modules/opportunities/eoi-record/workflow";

const origin = "http://127.0.0.1:3000";
const url = (query = "") =>
  `${origin}/api/opportunities/eoi/12/workflow${query}`;
const params = { params: Promise.resolve({ id: "12" }) };
const post = (body: unknown, from = origin) =>
  POST(
    new Request(url(), {
      method: "POST",
      headers: { "content-type": "application/json", origin: from },
      body: JSON.stringify(body),
    }),
    params,
  );
const all: Rights = { read: true, edit: true, delete: true };
function grantAll() {
  for (const page of [
    "opportunities-eoi-approvals",
    "eoi-add-stage",
    "eoi-add-approver",
    "opportunities-eoi-change-approver",
  ])
    state.roles.set(page, all);
}
const stage = (over: Record<string, unknown> = {}) => ({
  approval_number: "9001",
  stage_id: 501,
  level_name: "Stage 1",
  level_desc: "Review",
  approval_group: "83",
  approval_type: "Approval",
  no_of_approval_req: 1,
  status: "Pending",
  stage_type: "M",
  approve_button_flag: "N",
  ...over,
});
let route: Record<string, unknown>[] = [];
let users: Record<string, unknown>[] = [];
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  state.oracle.mockReset();
  state.oracleWrite.mockReset();
  state.oracleWrite.mockResolvedValue({ response_message: "Approver added" });
  state.reference.mockReset();
  state.forget.mockReset();
  state.roles = new Map();
  state.status = "DRFT";
  state.username = "alex.morgan@example.org";
  state.locked = false;
  state.labels = null;
  route = [stage()];
  users = [
    {
      user_name: "sam.taylor@example.org",
      name: "Sam Taylor",
      status: "Pending",
    },
    { user_name: "jo.lee@example.org", name: "Jo Lee", status: "Pending" },
  ];
  state.oracle.mockImplementation(async (op: string) => {
    if (op === "getApproval_setupApproval_stages") return { items: route };
    if (op === "getApproval_setupApproval_stages_graph")
      return {
        nodeStructure: {
          text: { name: "Approval Workflow", title: "Start" },
          children: route.map((item) => ({
            text: {
              name: item.level_desc,
              title: item.status,
              contact: item.level_name,
            },
            data: { approval_number: "EOI_12", status: item.status },
          })),
        },
      };
    if (op === "getApproval_setupGet_stage_users") return { items: users };
    if (op === "getPre_awardGetApprovalHistory")
      return {
        items: [
          {
            approval_history_id: 1,
            full_name: "Alex Morgan",
            status: "Submitted",
            stage_desc: "Stage 0",
            user_comments: "<p>Ready</p>",
            last_update_date: "2026-10-02T10:15:00Z",
          },
        ],
      };
    return { items: [] };
  });
  state.reference.mockImplementation(
    async (op: string, headers: Record<string, string>) => {
      if (op === "getPre_awardGetPersonList")
        return {
          items: [
            {
              person_id: 101,
              full_name: "Alex Morgan",
              email_address: "alex.morgan@example.org",
            },
            {
              person_id: 103,
              full_name: "Pat Kim",
              email_address: "pat.kim@example.org",
            },
            { person_id: 104, full_name: "No Email", email_address: null },
          ],
        };
      if (op === "getApproval_groupApproval_group_m")
        return headers.approver_type === "GROUP"
          ? { items: [{ approver_id: "83", approver_desc: "Approvers" }] }
          : { items: [] };
      return {
        items: [
          { lookup_type_code: "APPROVAL_TYPE", lookup_code: "APPROVAL" },
          { lookup_type_code: "APPR_GRP_DETAIL_TYPE", lookup_code: "GROUP" },
          {
            lookup_type_code: "APPR_GRP_DETAIL_TYPE",
            lookup_code: "INDIVIDUAL",
          },
        ],
      };
    },
  );
});

describe("route gates", () => {
  it("fails closed without the record's roles: nothing to submit, add or delete", async () => {
    const view = await workflowView(await eoiApprovalHost("12"));
    expect(view.gates).toEqual({
      generate: false,
      submit: false,
      withdraw: false,
      addStage: false,
    });
    expect(view.stages[0]).toMatchObject({ canDelete: false, canAct: false });
    expect(view.graph?.children[0].name).toBe("Review");
    for (const body of [
      { op: "act", action: "Submitted" },
      { op: "generate" },
      { op: "delete-stage", stageId: "501" },
      { op: "add-approver", stageId: "501", personId: "103" },
    ])
      expect((await post(body)).status).toBe(403);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("opens the draft's actions with the roles, and drops held roles after a write", async () => {
    grantAll();
    const view = await workflowView(await eoiApprovalHost("12"));
    expect(view.gates).toMatchObject({ submit: true, addStage: true });
    expect(view.stages[0].canDelete).toBe(true);
    expect("rows" in view.history && view.history.rows[0].comments).toBe(
      "Ready",
    );
    expect((await post({ op: "act", action: "Submitted" })).status).toBe(200);
    expect(state.forget).toHaveBeenCalledWith(
      "getSecurityUser_roles",
      "isolated-token",
    );
  });
  it("hides Submit while a stage is in Rework, and Add Stage on a locked page or an RB 'N'", async () => {
    grantAll();
    route = [stage({ status: "Rework" })];
    expect((await workflowView(await eoiApprovalHost("12"))).gates.submit).toBe(
      false,
    );
    route = [stage()];
    state.locked = true;
    expect(
      (await workflowView(await eoiApprovalHost("12"))).gates.addStage,
    ).toBe(false);
    state.locked = false;
    const { mergeResourceDefaults } = await vi.importActual<
      typeof import("@/server/platform/configuration/resources")
    >("@/server/platform/configuration/resources");
    state.labels = mergeResourceDefaults([
      {
        module_name: "OPPORTUNITIES-EOI",
        label_type: "button-labels",
        label_name: "approvals-add-stage",
        label_value: "Add Stage",
        is_visible: "N",
      },
    ]);
    expect(
      (await workflowView(await eoiApprovalHost("12"))).gates.addStage,
    ).toBe(false);
  });
  it("withdraws only an application in approval", async () => {
    grantAll();
    expect((await post({ op: "act", action: "Withdrawn" })).status).toBe(403);
    state.status = "AIA";
    expect((await post({ op: "act", action: "Withdrawn" })).status).toBe(200);
  });
  it("refuses a stage that is not on the route", async () => {
    grantAll();
    expect((await post({ op: "delete-stage", stageId: "999" })).status).toBe(
      400,
    );
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
});

describe("actor and payloads", () => {
  it("submits as the session's user, never a browser-sent actor", async () => {
    grantAll();
    expect(
      (
        await post({
          op: "act",
          action: "Submitted",
          action_by: "someone.else@example.org",
        })
      ).status,
    ).toBe(400);
    await post({ op: "act", action: "Submitted", comments: " Please review " });
    expect(lead(state.oracleWrite)).toContainEqual([
      "postApproval_setupPost_approval",
      { token: "isolated-token" },
      {
        action_by: "alex.morgan@example.org",
        action_done: "Submitted",
        comments: "Please review",
        criteria_type: "Amount",
        doc_num: "EOI_12",
        doc_type: "OPPORTUNITIES-EOI",
      },
    ]);
  });
  it("refuses every actor-named action without a verified username", async () => {
    grantAll();
    state.username = undefined;
    const view = await workflowView(await eoiApprovalHost("12"));
    expect(view.gates.submit).toBe(false);
    expect((await post({ op: "act", action: "Submitted" })).status).toBe(403);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("lets only the backend's current approver decide, and asks why on a rejection", async () => {
    state.status = "AIA";
    route = [stage({ stage_id: 602, approve_button_flag: "N" })];
    expect(
      (await post({ op: "act", action: "Approved", stageId: "602" })).status,
    ).toBe(403);
    route = [stage({ stage_id: 602, approve_button_flag: "Y" })];
    expect(
      (await post({ op: "act", action: "Rejected", stageId: "602" })).status,
    ).toBe(400);
    await post({ op: "act", action: "Approved", stageId: "602" });
    expect(lead(state.oracleWrite)).toContainEqual([
      "postApproval_setupPost_approval",
      { token: "isolated-token" },
      {
        action_by: "alex.morgan@example.org",
        action_done: "Approved",
        criteria_type: "Amount",
        doc_num: "EOI_12",
        doc_type: "OPPORTUNITIES-EOI",
        stage_id: 602,
      },
    ]);
  });
  it("generates the route with its document and the session's user in the query", async () => {
    grantAll();
    route = [];
    await post({ op: "generate" });
    const [op, headers, body, signal, query] = state.oracleWrite.mock.calls[0];
    expect([op, headers, body, signal]).toEqual([
      "getApproval_setupGenerate_stages",
      { token: "isolated-token" },
      undefined,
      undefined,
    ]);
    expect(String(query)).toBe(
      "doc_num=EOI_12&doc_type=OPPORTUNITIES-EOI&action_by=alex.morgan%40example.org",
    );
  });
  it("adds a stage with an explicit pick and server identity", async () => {
    grantAll();
    const body = {
      op: "add-stage",
      position: "501",
      name: "Finance",
      description: "Finance check",
      actionType: "APPROVAL",
      groupType: "INDIVIDUAL",
      group: "103",
      count: 4,
      deadlineDays: 5,
      remarks: "Needed",
      helpText: "<p>secret help</p>",
    };
    expect((await post({ ...body, user_id: 1 })).status).toBe(400);
    expect((await post({ ...body, group: "999" })).status).toBe(400);
    expect((await post(body)).status).toBe(200);
    const [op, headers, payload, , query] = state.oracleWrite.mock.calls[0];
    expect(op).toBe("postApproval_setupAdd_stage");
    expect(headers).toEqual({
      token: "isolated-token",
      legal_id: "77",
      org_id: "202",
    });
    // help-text is seeded hidden, so it is sent empty; an individual stage needs one action.
    expect(payload).toEqual({
      approval_group: "103",
      approval_group_type: "INDIVIDUAL",
      approval_type: "APPROVAL",
      doc_num: "EOI_12",
      lead_stage_id: 501,
      legal_id: 77,
      no_of_approval_req: 1,
      remarks: "Needed",
      stage_desc: "Finance check",
      stage_name: "Finance",
      org_id: 202,
      user_id: 101,
      deadline_days: 5,
      help_text: undefined,
    });
    expect(String(query)).toBe("doc_type=OPPORTUNITIES-EOI");
  });
  it("deletes a stage with its route number and id", async () => {
    grantAll();
    await post({ op: "delete-stage", stageId: "501" });
    expect(lead(state.oracleWrite, 2)).toContainEqual([
      "deleteApproval_setupApproval_stages",
      {
        token: "isolated-token",
        approval_number: "9001",
        approval_stage_id: "501",
      },
    ]);
  });
});

describe("approvers", () => {
  it("shows a stage's approvers with its gates, and refuses a system step's changes", async () => {
    grantAll();
    const res = await GET(new Request(url("?view=users&stage=501")), params);
    expect(await res.json()).toEqual({
      users: [
        { id: "sam.taylor@example.org", name: "Sam Taylor", status: "Pending" },
        { id: "jo.lee@example.org", name: "Jo Lee", status: "Pending" },
      ],
      system: false,
      gates: { add: true, change: true, remove: true },
    });
    users = [
      { user_name: "sys", name: "Automatic System Step", status: "Pending" },
    ];
    expect(
      (await post({ op: "add-approver", stageId: "501", personId: "103" }))
        .status,
    ).toBe(403);
  });
  it("adds, changes and removes approvers by email the server looked up", async () => {
    grantAll();
    const added = await post({
      op: "add-approver",
      stageId: "501",
      personId: "103",
    });
    expect(await added.json()).toEqual({ message: "Approver added" });
    await post({
      op: "change-approver",
      stageId: "501",
      current: "sam.taylor@example.org",
      personId: "103",
    });
    await post({
      op: "remove-approver",
      stageId: "501",
      user: "jo.lee@example.org",
    });
    const calls = state.oracleWrite.mock.calls;
    expect(calls[0].slice(0, 2)).toEqual([
      "postApproval_setupApproval_stages_users",
      {
        token: "isolated-token",
        p_new_appr: "pat.kim@example.org",
        p_stage_id: "501",
      },
    ]);
    expect(String(calls[0][4])).toBe(
      "doc_type=OPPORTUNITIES-EOI&doc_num=EOI_12",
    );
    expect(calls[1].slice(0, 2)).toEqual([
      "postApproval_setupReassign_stage",
      {
        token: "isolated-token",
        p_current_appr: "sam.taylor@example.org",
        p_new_appr: "pat.kim@example.org",
        p_stage_id: "501",
      },
    ]);
    expect(calls[2].slice(0, 2)).toEqual([
      "deleteApproval_setupApproval_stages_users",
      {
        token: "isolated-token",
        p_appr: "jo.lee@example.org",
        p_stage_id: "501",
      },
    ]);
    expect(String(calls[2][4])).toBe(
      "doc_num=EOI_12&doc_type=OPPORTUNITIES-EOI",
    );
  });
  it("refuses a duplicate, a person without an email, or an approver not on the stage", async () => {
    grantAll();
    for (const body of [
      { op: "add-approver", stageId: "501", personId: "104" },
      {
        op: "change-approver",
        stageId: "501",
        current: "sam.taylor@example.org",
        personId: "999",
      },
    ])
      expect((await post(body)).status).toBe(400);
    expect(
      (
        await post({
          op: "remove-approver",
          stageId: "501",
          user: "nobody@example.org",
        })
      ).status,
    ).toBe(403);
    users = [users[0]];
    // One approver left: it cannot be removed.
    expect(
      (
        await post({
          op: "remove-approver",
          stageId: "501",
          user: "sam.taylor@example.org",
        })
      ).status,
    ).toBe(403);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
});

describe("route", () => {
  it("refuses a cross-origin write and a malformed body", async () => {
    grantAll();
    expect(
      (await post({ op: "act", action: "Submitted" }, "https://evil.example"))
        .status,
    ).toBe(403);
    const bad = await POST(
      new Request(url(), {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: "{not json",
      }),
      params,
    );
    expect(bad.status).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("passes the write gate's refusal through", async () => {
    grantAll();
    state.oracleWrite.mockRejectedValueOnce(
      new AppError("WRITES_DISABLED", "Saving isn't enabled.", 409),
    );
    const res = await post({ op: "act", action: "Submitted" });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("WRITES_DISABLED");
  });
  it("lists only listed group types and keeps the token out of every read", async () => {
    grantAll();
    expect(
      (await GET(new Request(url("?view=groups&type=EVIL")), params)).status,
    ).toBe(400);
    const groups = await GET(
      new Request(url("?view=groups&type=GROUP")),
      params,
    );
    expect(await groups.json()).toEqual([{ value: "83", label: "Approvers" }]);
    const view = await GET(new Request(url()), params);
    expect(JSON.stringify(await view.json())).not.toMatch(/isolated-token/);
  });
});
