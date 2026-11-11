import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  fundStatus: "DRFT",
  unapplied: 0 as number | null,
  activities: 1,
  amendmentStatus: "ADJ_DRFT",
  edit: "Y",
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "t", username: "ada@example.com" },
    user: {
      personId: "101",
      organizationId: "202",
      modules: { "claims-group": true, "claims-unit-inquiry": true },
    },
  }),
}));
vi.mock("@/server/record/approvals/actor", () => ({
  approvalActor: async () => "ada@example.com",
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [],
}));
vi.mock("@/server/oracle/api", () => ({
  roles: {
    record: async () => ({
      items: [
        ["claims-unit-summary", "Y"],
        ["claims-unit-activities", state.edit],
      ].map(([page_name, edit]) => ({
        page_name,
        read_access: "Y",
        edit_access: edit,
        delete_access: "N",
      })),
    }),
  },
  lookups: { codes: async () => ({ items: [] }) },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_FUNDS", "DRFT", "Y"],
        ["CLAIM_FUNDS", "IA", "N"],
        ["CLAIM_FUNDS_AMENDMENT", "ADJ_DRFT", "Y"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({
      items: [{ app_fund_id: 264, fund_type_id: 1, fund_status_code: "IA" }],
    }),
    fundCategories: async () => ({
      items: [
        {
          fund_status_code: state.fundStatus,
          unapplied_balance: state.unapplied,
        },
      ],
    }),
    activities: async () => ({
      items: Array.from({ length: state.activities }, (_, i) => ({
        activity_id: 700 + i,
        amend_version_id: 920 + i,
      })),
    }),
    amendments: async () => ({
      items: [{ amendment_id: 603, status_code: state.amendmentStatus }],
    }),
    amendmentLines: async () => ({ items: [{ amend_version_id: 1 }] }),
    activity: async () => ({
      items: [{ activity_id: 700, amend_version_id: 920, app_fund_id: 264 }],
    }),
    roster: async () => ({ items: [{ roster_id: 261 }] }),
  },
}));
import { unitApprovalHost } from "@/server/modules/claims/units/record/approvals";

beforeEach(() => {
  state.fundStatus = "DRFT";
  state.unapplied = 0;
  state.activities = 1;
  state.amendmentStatus = "ADJ_DRFT";
  state.edit = "Y";
});

describe("Claims approval host (legacy claims-unit-activities approvals)", () => {
  it("a planned draft fund submits, generating its route; Claims' own keys", async () => {
    const host = await unitApprovalHost("384", "fund-264");
    expect(host).toMatchObject({
      docNum: "264",
      docType: "CLAIM_FUNDS",
      approvalType: "CLAIM_FUNDS",
      submitGenerates: true,
      keys: { submit: "submit-approval", withdraw: "withdraw-approval" },
      state: { editable: true, withdraw: false },
      rights: { route: true },
    });
  });
  it("is not editable with an Unapplied Balance, no activities, or outside draft and rework", async () => {
    state.unapplied = 10;
    expect((await unitApprovalHost("384", "fund-264")).state.editable).toBe(
      false,
    );
    state.unapplied = 0;
    state.activities = 0;
    expect((await unitApprovalHost("384", "fund-264")).state.editable).toBe(
      false,
    );
    state.activities = 1;
    state.fundStatus = "AIA";
    const inApproval = await unitApprovalHost("384", "fund-264");
    expect(inApproval.state).toMatchObject({ editable: false, withdraw: true });
  });
  it("needs the Activities page's edit right for the route's actions (fail closed)", async () => {
    state.edit = "N";
    expect((await unitApprovalHost("384", "fund-264")).rights.route).toBe(
      false,
    );
  });
  it("an amendment's route is its own document, opened by its lines and status", async () => {
    const host = await unitApprovalHost("384", "amendment-264-603");
    expect(host).toMatchObject({
      docNum: "603",
      docType: "CLAIM_FUNDS_AMENDMENT",
      state: { editable: true },
    });
    state.amendmentStatus = "ADJ_AIA";
    expect(
      (await unitApprovalHost("384", "amendment-264-603")).state,
    ).toMatchObject({ editable: false, withdraw: true });
  });
  it("an activity version's and a roster member's routes only read and act; others are refused", async () => {
    expect(await unitApprovalHost("384", "activity-264-700-920")).toMatchObject(
      {
        docNum: "920",
        docType: "CLAIM_ACTIVITY",
        state: { editable: false, withdraw: false },
      },
    );
    expect(await unitApprovalHost("384", "roster-261")).toMatchObject({
      docNum: "261",
      docType: "CLAIM_ROSTER",
      state: { editable: false },
    });
    await expect(unitApprovalHost("384", "roster-9")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(unitApprovalHost("384", "fund-9")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(unitApprovalHost("384", "award-1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
