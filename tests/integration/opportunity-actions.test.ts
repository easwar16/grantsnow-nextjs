import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  roles: [] as {
    page_name: string;
    read_access: string;
    edit_access?: string;
  }[],
  labels: [] as Record<string, unknown>[],
}));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "server-token" },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: { "opportunities-finder": true },
    },
  }),
}));
vi.mock("@/server/api/transport", () => ({
  oracle: state.oracle,
  oracleWrite: state.oracleWrite,
}));
vi.mock("@/server/configuration/service", () => ({
  dashboardRoles: async () => state.roles,
  organizations: async () => [{ id: "202", name: "Fixture organization" }],
}));
vi.mock("@/server/configuration/formatting", () => ({
  formattingConfiguration: async () => ({ currency: "GBP", decimals: 2 }),
}));
vi.mock("@/server/configuration/resources", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/configuration/resources")
  >()),
  resources: async () => state.labels,
}));
import { POST, GET } from "@/app/api/opportunities/actions/[action]/route";
import {
  defaultFormResponse,
  proposalPayload,
  sharePayload,
  sponsorDeadlines,
  matchSponsor,
} from "@/server/opportunities/payloads";
import {
  cardActions,
  convertGates,
  pageAccess,
} from "@/server/opportunities/gates";
import {
  endDateAfter,
  monthsBetween,
  nearDeadline,
} from "@/features/opportunities/components/actions/duration";
import { shareProblem } from "@/features/opportunities/components/actions/share-dialog";
const origin = "http://127.0.0.1:3000";
const post = (action: string, body: unknown, from = origin) =>
  POST(
    new Request(`${origin}/api/opportunities/actions/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: from },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );
const get = (action: string, query: string) =>
  GET(new Request(`${origin}/api/opportunities/actions/${action}?${query}`), {
    params: Promise.resolve({ action }),
  });
const grant = (...pages: string[]) =>
  pages.map((page_name) => ({
    page_name,
    read_access: "Y",
    edit_access: "Y",
  }));
const opportunity = (over: Record<string, unknown> = {}) => ({
  items: [
    {
      opportunities_id: 5,
      opp_heading: "Server heading",
      opportunity_status: "OPEN",
      funders: "Research Council, Other (A, B)",
      deadline_date: "2026-12-01, 2027-01-15",
      closing_date: "2026-12-01",
      call: "C1",
      programme: "P1",
      activity_type: "CASH",
      create_application_of_interest: "Y",
      create_outline_application: "Y",
      create_grant_application: "Y",
      ...over,
    },
  ],
});
/** The reads a convert makes, keyed by operation. */
function convertReads(op: string) {
  if (op === "getSharedGetOpportunities") return opportunity();
  if (op === "getPre_awardGetPersonList")
    return {
      items: [
        {
          person_id: 101,
          full_name: "Alex Morgan",
          employee_number: "E101",
          org_unit_id: 202,
          is_pi_flag: "true",
        },
        { person_id: 102, full_name: "Not a PI", is_pi_flag: "false" },
      ],
    };
  if (op === "getPre_awardGetLkpOrgUnitType")
    return { items: [{ ORG_UNIT_ID: 202, ORG_UNIT_NAME: "University" }] };
  if (op === "GetSponsorList")
    return {
      items: [{ sponsor_party_id: 301, party_name: "The Research Council" }],
    };
  if (op === "getPre_awardGetLookupTypesCodes")
    return {
      items: [
        { lookup_type_code: "ACTIVITY_TYPE", lookup_code: "CASH" },
        { lookup_type_code: "PROPOSAL_STAGE", lookup_code: "SINGLE" },
      ],
    };
  if (op === "getProposalEthical_dynFormsP_ref_module")
    return [
      {
        formId: 9,
        sections: [
          {
            sectionId: 1,
            fields: [
              { fieldId: 1, fieldType: "NUMERIC", defaultValue: "4" },
              { fieldId: 2, fieldType: "CHECKBOX", defaultValue: "a~~b" },
              { fieldId: 3, fieldType: "TEXT", defaultValue: null },
            ],
          },
        ],
      },
    ];
  throw new Error(`unexpected read ${op}`);
}
const convertBody = {
  opener: "finder",
  kind: "PROPOSAL",
  opportunityId: 5,
  piId: 101,
  orgUnitId: 202,
  activityType: "CASH",
  stage: "SINGLE",
  start: "2026-01-01",
  end: "2026-12-31",
  sponsorId: 301,
  confidential: "N",
};
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  state.oracle.mockReset();
  state.oracleWrite.mockReset().mockResolvedValue({});
  state.roles = [];
  state.labels = [];
});
afterEach(() => vi.unstubAllEnvs());
describe("payload builders", () => {
  it("shares to people or to a role, never both, and sends an empty comment as null (8516)", () => {
    expect(
      sharePayload({
        opportunityId: 5,
        sendTo: "INDIVIDUAL",
        personIds: [1, 2],
        comment: "  ",
      }),
    ).toEqual([
      {
        obj_ref_id: 5,
        business_event: "OPP_SHARE",
        send_to: "INDIVIDUAL",
        pid: [1, 2],
        comments: null,
      },
    ]);
    expect(
      sharePayload({
        opportunityId: 5,
        sendTo: "ROLE",
        sendToValue: "R",
        comment: " hi ",
      })[0],
    ).toEqual({
      obj_ref_id: 5,
      business_event: "OPP_SHARE",
      send_to: "ROLE",
      send_to_value: "R",
      comments: "hi",
    });
  });
  it("builds the convert body with the correct sponsor key and one SPNS deadline per date", () => {
    const body = proposalPayload({
      kind: "OUTLINE_PROPOSAL",
      opportunity: { id: 5, heading: "H", deadline: "2026-12-01, 2027-01-15" },
      pi: { personId: 1, employeeNumber: "E1", orgUnitId: 2 },
      activityType: null,
      stage: "SINGLE",
      start: "2026-01-01",
      end: "2026-12-31",
      sponsorId: 301,
      confidential: "N",
      createdBy: 1,
      currency: "GBP",
    }).proposals;
    expect(body.proposal_deadlines).toEqual(
      sponsorDeadlines("2026-12-01,2027-01-15"),
    );
    expect(body.proposal_deadlines).toHaveLength(2);
    expect(body.proposal_sponsors[0]).toMatchObject({
      sponsor_party_id: 301,
      sponsor_type: "PRM",
    });
    expect(body).not.toHaveProperty("request_id");
    expect(body.enforce_deadline_y_n).toBe("N");
    expect(body.proposal_stage).toBe("SINGLE");
  });
  it("seeds dynamic-form defaults by field type and matches the sponsor on the first funder", () => {
    expect(
      defaultFormResponse([
        {
          formId: 1,
          sections: [
            {
              sectionId: 2,
              fields: [
                { fieldId: 3, fieldType: "NUMERIC", defaultValue: null },
                { fieldId: 4, fieldType: "CHECKLIST", defaultValue: null },
              ],
            },
          ],
        },
      ]),
    ).toEqual([
      {
        form_id: 1,
        sections: [
          {
            section_id: 2,
            fields: [
              { field_id: 3, value: null },
              { field_id: 4, value: [] },
            ],
          },
        ],
      },
    ]);
    expect(
      matchSponsor(
        [{ id: 1, name: "UK Research Council" }],
        "research council",
      ),
    ).toEqual({ id: 1, name: "UK Research Council" });
    expect(matchSponsor([{ id: 1, name: "X" }], undefined)).toBeNull();
  });
});
describe("gates", () => {
  it("is role based: every row must grant, and unknown roles fail closed", () => {
    expect(pageAccess(null, "p").read).toBe(false);
    expect(
      pageAccess(
        [
          { page_name: "p", read_access: "Y", edit_access: "Y" },
          { page_name: "p", read_access: "N", edit_access: "Y" },
        ],
        "p",
      ),
    ).toEqual({ read: false, edit: true });
  });
  it("shows the finder pills, More Info and Shared-tab comments, and Home none of them (GN-Angular CardView)", () => {
    const rows = ["new", "closing-soon", "status"].map((label_name) => ({
      module_name: "OPPORTUNITIES-EOI",
      label_type: "labels",
      label_name,
      is_visible: "Y" as const,
    }));
    const finder = cardActions(rows, null, "finder", "shared", 3);
    expect(finder).toMatchObject({
      pills: { new: true, closingSoon: true },
      moreInfo: true,
      comments: true,
      apply: false,
      deadlineWarningDays: 3,
    });
    const home = cardActions(rows, null, "dashboard", "", null);
    expect(home).toMatchObject({
      pills: { new: false, closingSoon: false },
      moreInfo: false,
      status: true,
      comments: false,
    });
  });
  it("needs the access grant and the RB row for Apply and Notes", () => {
    const rows = [
      {
        module_name: "DASHBOARD",
        label_type: "button-labels",
        label_name: "apply",
        is_visible: "Y" as const,
      },
    ];
    expect(
      cardActions(rows, grant("apply-opportunities"), "dashboard", "", null)
        .apply,
    ).toBe(true);
    expect(cardActions(rows, [], "dashboard", "", null).apply).toBe(false);
    expect(
      cardActions(rows, grant("opportunity-notes"), "dashboard", "", null)
        .notes,
    ).toBe(false);
  });
  it("gates convert fields per opener and kind, with seed-required fallbacks", () => {
    const rows = [
      "outline-proposal-stage",
      "proposal-stage",
      "activity-type",
      "full-name",
    ].map((label_name) => ({
      module_name: "OPPORTUNITIES-EOI",
      label_type: "labels",
      label_name,
      label_value: label_name === "outline-proposal-stage" ? "OP Stage" : null,
      is_visible: "Y" as const,
      ...(label_name === "full-name" ? { is_mandatory: "N" } : {}),
    }));
    const outline = convertGates(rows, "finder", "OUTLINE_PROPOSAL");
    expect(outline.stage).toEqual({
      show: true,
      required: true,
      label: "OP Stage",
    });
    expect(outline["activity-type"].required).toBe(false);
    expect(outline["full-name"].required).toBe(false);
    expect(outline["org-unit"]).toMatchObject({ show: false, required: false });
    expect(convertGates(rows, "dashboard", "PROPOSAL").stage.show).toBe(false);
  });
});
describe("POST /api/opportunities/actions", () => {
  it("rejects a foreign origin, unknown and prototype actions before any call", async () => {
    expect(
      (
        await post(
          "bookmark",
          { opportunityId: 5, bookmarked: true },
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    expect((await post("toString", {})).status).toBe(400);
    expect((await post("delete", {})).status).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("bookmarks and un-bookmarks with the server token, and reports writes switched off", async () => {
    expect(
      (await post("bookmark", { opportunityId: 5, bookmarked: true })).status,
    ).toBe(200);
    expect(state.oracleWrite).toHaveBeenCalledWith("postSharedBookmarkOpp", {
      token: "server-token",
      p_opp_id: "5",
    });
    state.oracleWrite.mockRejectedValueOnce(
      new AppError(
        "WRITES_DISABLED",
        "Saving isn't enabled in this build yet.",
        409,
      ),
    );
    const off = await post("bookmark", { opportunityId: 5, bookmarked: false });
    expect(off.status).toBe(409);
    expect((await off.json()).error.code).toBe("WRITES_DISABLED");
    expect(state.oracleWrite).toHaveBeenLastCalledWith(
      "deleteSharedBookmarkOpp",
      { token: "server-token", p_opp_id: "5" },
    );
  });
  it("refuses identity fields smuggled into a write", async () => {
    expect(
      (await post("bookmark", { opportunityId: 5, bookmarked: true, pid: 9 }))
        .status,
    ).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("saves notes only with edit access, sanitised", async () => {
    const body = { opportunityId: 5, notes: "<p>x<script>bad()</script></p>" };
    expect((await post("notes", body)).status).toBe(403);
    state.roles = grant("opportunity-notes");
    const saved = await post("notes", body);
    expect(saved.status).toBe(200);
    const [, , payload] = state.oracleWrite.mock.calls[0];
    expect(payload.opportunity_id).toBe(5);
    expect(payload.notes).not.toMatch(/script/);
    expect((await saved.json()).notes).toBe(payload.notes);
  });
  it("shares only to recipients the dialog offers", async () => {
    state.oracle.mockResolvedValue({
      items: [{ value: "R1", description: "Role one" }],
    });
    expect(
      (
        await post("share", {
          opportunityId: 5,
          sendTo: "ROLE",
          sendToValue: "R2",
          comment: "",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post("share", {
          opportunityId: 5,
          sendTo: "ROLE",
          sendToValue: "R1",
          comment: "Look",
        })
      ).status,
    ).toBe(200);
    expect(state.oracleWrite).toHaveBeenCalledTimes(1);
    expect(state.oracleWrite.mock.calls[0][2][0]).toMatchObject({
      send_to_value: "R1",
      comments: "Look",
    });
  });
  it("applies only to an open opportunity that allows it, and returns the new request id", async () => {
    state.roles = grant("apply-opportunities");
    state.oracle.mockResolvedValue(
      opportunity({ opportunity_status: "CLOSED" }),
    );
    expect((await post("apply", { opportunityId: 5 })).status).toBe(403);
    state.oracle.mockResolvedValue(opportunity());
    state.oracleWrite.mockResolvedValue({ request_id: 88 });
    const applied = await post("apply", { opportunityId: 5 });
    expect(await applied.json()).toEqual({ requestId: "88" });
    expect(state.oracleWrite).toHaveBeenCalledWith(
      "getDynamicFormsInsertRequest",
      {
        token: "server-token",
        P_REF_OBJECT_ID: "5",
        P_REF_OBJECT_TYPE: "OPPORTUNITIES",
        P_REQUEST_TYPE: "OPPORTUNITIES-EOI",
      },
    );
  });
  it("stops a convert with a missing required field before any write", async () => {
    state.roles = grant("convert-opportunity-to-proposal");
    state.labels = [
      {
        module_name: "OPPORTUNITIES-EOI",
        label_type: "labels",
        label_name: "proposal-stage",
        is_visible: "Y" as const,
      },
    ];
    state.oracle.mockImplementation(async (op: string) => convertReads(op));
    const response = await post("convert", { ...convertBody, stage: null });
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe(
      "Please fill all the required fields",
    );
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("converts with server identity and title, then seeds PROPOSALS-SUMMARY", async () => {
    state.roles = grant("convert-opportunity-to-proposal");
    state.oracle.mockImplementation(async (op: string) => convertReads(op));
    state.oracleWrite
      .mockResolvedValueOnce({ proposal: 900, Prop_id: 901 })
      .mockResolvedValueOnce({});
    const response = await post("convert", convertBody);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      href: "/proposals/PROPOSAL/901",
    });
    const [op, headers, body] = state.oracleWrite.mock.calls[0];
    expect(op).toBe("postProposalProposal");
    expect(headers).toEqual({
      token: "server-token",
      legal_id: "77",
      org_id: "202",
    });
    expect(body.proposals).toMatchObject({
      proposal_title: "Server heading",
      created_by: 101,
      converted_from_opp_id: 5,
      currency_code: "GBP",
      attribute_1: "C1",
      proposal_departments: [
        { person_id: 101, employee_number: "E101", org_unit_id: 202 },
      ],
    });
    expect(state.oracleWrite.mock.calls[1].slice(0, 2)).toEqual([
      "postDynamicFormsDynFormResponse",
      {
        token: "server-token",
        P_TOKEN: "server-token",
        P_FORM_ID: "9",
        P_OBJECT_ID: "900",
        P_OBJECT_TYPE: "PROPOSALS-SUMMARY",
      },
    ]);
    expect(state.oracleWrite.mock.calls[1][2][0].sections[0].fields).toEqual([
      { field_id: 1, value: 4 },
      { field_id: 2, value: ["a", "b"] },
      { field_id: 3, value: "" },
    ]);
  });
  it("rejects a PI the list does not offer", async () => {
    state.roles = grant("convert-opportunity-to-proposal");
    state.oracle.mockImplementation(async (op: string) => convertReads(op));
    expect((await post("convert", { ...convertBody, piId: 102 })).status).toBe(
      400,
    );
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("opens the convert dialog with the user as PI, their org unit preloaded and the matched sponsor", async () => {
    state.roles = grant("convert-opportunity-to-proposal");
    state.oracle.mockImplementation(async (op: string) => convertReads(op));
    const response = await get(
      "convert",
      "opener=finder&kind=PROPOSAL&opportunityId=5",
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.initial).toMatchObject({
      piId: "101",
      orgUnitId: "202",
      sponsorId: "301",
      activityType: "CASH",
    });
    expect(body.pis).toHaveLength(1);
  });
});
describe("client helpers", () => {
  it("counts inclusive calendar months and back", () => {
    expect(monthsBetween("2026-01-01", "2026-12-31", 2)).toBe(12);
    expect(endDateAfter("2026-01-01", 12, 2)).toBe("2026-12-31");
  });
  it("warns only inside the configured window before the closing time", () => {
    const now = Date.parse("2026-11-29T00:00:00Z");
    expect(nearDeadline("2026-12-01T00:00:00Z", 3, now)).toBe(true);
    expect(nearDeadline("2026-12-01T00:00:00Z", null, now)).toBe(false);
    expect(nearDeadline("2026-11-28T00:00:00Z", 3, now)).toBe(false);
    expect(nearDeadline(undefined, 3, now)).toBe(false);
  });
  it("validates a share in the original order", () => {
    const texts = {
      sendToRequired: "a",
      sendToValueRequired: "b",
      fullNameRequired: "c",
      tooLong: "d",
    };
    const ok = { sendTo: "ROLE", value: "R", people: [], comment: "" };
    expect(shareProblem(texts, { ...ok, sendTo: "" }, 5)).toBe("a");
    expect(shareProblem(texts, { ...ok, value: "" }, 5)).toBe("b");
    expect(shareProblem(texts, { ...ok, sendTo: "INDIVIDUAL" }, 5)).toBe("c");
    expect(shareProblem(texts, { ...ok, comment: "toolong" }, 5)).toBe("d");
    expect(shareProblem(texts, ok, 5)).toBeNull();
  });
});
