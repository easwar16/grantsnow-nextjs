import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  fundStatus: "DRFT",
  saved: [] as Record<string, unknown>[],
  writes: [] as [string, unknown][],
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "t" },
    user: {
      organizationId: "202",
      modules: { "claims-group": true, "claims-unit-inquiry": true },
    },
  }),
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [],
}));
vi.mock("@/server/oracle/api", () => ({
  roles: {
    record: async () => ({
      items: ["claims-unit-summary", "claims-unit-activities"].map((p) => ({
        page_name: p,
        read_access: "Y",
        edit_access: "Y",
        delete_access: "N",
      })),
    }),
  },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_FUNDS", "DRFT", "Y"],
        ["CLAIM_FUNDS", "IA", "N"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({
      items: [{ app_fund_id: 264, fund_type_id: 1 }],
    }),
    fundCategories: async () => ({
      items: [
        {
          fund_status_code: state.fundStatus,
          requirements: [
            {
              req_id: 5,
              form_id: 103,
              req_type_code: "PARENT_POLICY",
              reference_module: "COMPLIANCE-SURVEY",
            },
          ],
        },
      ],
    }),
    requirements: async () => ({ items: state.saved }),
    createRequirement: async (p: { body: Record<string, unknown> }) => {
      state.writes.push(["post", p]);
      state.saved.push({
        ...p.body,
        app_requirement_id: 900,
        form_id: 103,
        reference_module: "COMPLIANCE-SURVEY",
      });
    },
    updateRequirement: async (p: unknown) => void state.writes.push(["put", p]),
  },
}));
import {
  requirementsView,
  saveRequirement,
  unitFormAccess,
} from "@/server/modules/claims/units/record/requirements";

const input = {
  fund: "264",
  form: "103",
  name: "Ada Lovelace",
  email: "ada@example.com",
};
beforeEach(() => {
  state.fundStatus = "DRFT";
  state.saved = [];
  state.writes = [];
});

describe("Fund Summary requirements (legacy activitySummary.requirements)", () => {
  it("lists the fund's surveys, editable while the fund allows a user edit", async () => {
    const view = await requirementsView("384", "264");
    expect(view.editable).toBe(true);
    expect(view.items).toEqual([
      expect.objectContaining({
        key: "5",
        form: "103",
        slot: "COMPLIANCE-SURVEY",
        requirementId: null,
      }),
    ]);
    state.fundStatus = "IA";
    expect((await requirementsView("384", "264")).editable).toBe(false);
  });
  it("creates the requirement with legacy's body, then puts it back as read with the person responsible", async () => {
    expect(await saveRequirement("384", input)).toEqual({
      requirementId: "900",
    });
    expect(state.writes[0]).toEqual([
      "post",
      {
        appId: 384,
        body: {
          req_type_code: "PARENT_POLICY",
          person_responsible_name: "Ada Lovelace",
          person_responsible_email: "ada@example.com",
          app_fund_id: 264,
        },
      },
    ]);
    await saveRequirement("384", { ...input, name: "Grace Hopper" });
    expect(state.writes[1]).toEqual([
      "put",
      {
        id: 900,
        body: expect.objectContaining({
          app_requirement_id: 900,
          person_responsible_name: "Grace Hopper",
        }),
      },
    ]);
  });
  it("refuses an empty field, another form, and a fund closed to edits", async () => {
    await expect(
      saveRequirement("384", { ...input, email: " " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveRequirement("384", { ...input, form: "999" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.fundStatus = "IA";
    await expect(saveRequirement("384", input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("the shared form reads and saves only this application's requirement of that module", async () => {
    state.saved = [
      {
        app_requirement_id: 900,
        app_fund_id: 264,
        form_id: 103,
        reference_module: "COMPLIANCE-SURVEY",
      },
    ];
    await expect(
      unitFormAccess("384", "COMPLIANCE-SURVEY", "900", "edit"),
    ).resolves.toMatchObject({ record: { id: "900", number: "384" } });
    await expect(
      unitFormAccess("384", "OTHER-SURVEY", "900", "read"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      unitFormAccess("384", "COMPLIANCE-SURVEY", "901", "read"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.fundStatus = "IA";
    await expect(
      unitFormAccess("384", "COMPLIANCE-SURVEY", "900", "edit"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
