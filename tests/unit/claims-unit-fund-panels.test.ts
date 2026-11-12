import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as Record<string, string>[],
  rosterStatus: "DRFT",
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
  roles: { record: async () => ({ items: state.roles }) },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_ROSTER", "DRFT", "Y"],
        ["CLAIM_ROSTER", "APPROVED", "N"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({
      items: [
        { app_fund_id: 264, full_fund_display: "TITLE I", fund_type_id: 1 },
      ],
    }),
    roster: async () => ({
      items: [
        {
          roster_id: 261,
          first_name: "Ada",
          last_name: "Lovelace",
          certified_teacher_flag: "Y",
          pri_app_fund_id: 264,
          pri_fund_job_title: "TEACHER",
          pri_cred_doc_id: 55,
          roster_status: state.rosterStatus,
          roster_status_descr: "Pending",
        },
      ],
    }),
    createRoster: async (p: unknown) => void state.writes.push(["post", p]),
    updateRoster: async (p: unknown) => void state.writes.push(["put", p]),
    deleteRoster: async (p: unknown) => void state.writes.push(["delete", p]),
    equipments: async () => ({
      items: [
        {
          equipment_id: 181,
          item_description: "Projector",
          purchase_date: "2026-09-01T00:00:00Z",
          purchase_price: 1001,
          funding_sources: [{ app_fund_id: 264, fund_name: "TITLE I" }],
        },
      ],
    }),
    createEquipment: async (p: unknown) => void state.writes.push(["post", p]),
    updateEquipment: async (p: unknown) => void state.writes.push(["put", p]),
    deleteEquipment: async (p: unknown) =>
      void state.writes.push(["delete", p]),
  },
}));
import {
  deleteEquipment,
  equipmentView,
  saveEquipment,
} from "@/server/modules/claims/units/record/equipment";
import {
  deleteRoster,
  rosterView,
  saveRoster,
} from "@/server/modules/claims/units/record/roster";

const access = (page: string, edit = "Y") => ({
  page_name: page,
  read_access: "Y",
  edit_access: edit,
  delete_access: "N",
});
const member = {
  firstName: "Ada",
  lastName: "Lovelace",
  primaryFund: "264",
  primaryTitle: "TEACHER",
  secondaryFund: "",
  secondaryTitle: "",
  teacher: true,
  parapro: false,
  localFund: false,
};
const item = {
  description: "Projector",
  date: "2026-09-01",
  price: "1001",
  serial: "P-1",
  location: "Room 4",
  condition: "New",
  comments: "",
  funds: ["264"],
};
beforeEach(() => {
  state.roles = [
    access("claims-unit-summary"),
    access("claims-unit-activities"),
    access("activity-roster"),
    access("activity-equipment"),
  ];
  state.rosterStatus = "DRFT";
  state.writes = [];
});

describe("Roster (legacy rosterSection)", () => {
  it("a member is editable by the right and its CLAIM_ROSTER status", async () => {
    const view = await rosterView("384");
    expect(view.canAdd).toBe(true);
    expect(view.rows[0]).toMatchObject({
      key: "261",
      primaryFundName: "TITLE I",
      teacher: true,
      editable: true,
    });
    state.rosterStatus = "APPROVED";
    expect((await rosterView("384")).rows[0].editable).toBe(false);
    await expect(
      saveRoster("384", { ...member, roster: 261 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteRoster("384", { roster: 261 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("an update keeps the credential documents; a fund needs its job title; funds are the application's", async () => {
    await saveRoster("384", { ...member, roster: 261 });
    expect(state.writes[0]).toEqual([
      "put",
      expect.objectContaining({
        rosterId: 261,
        body: expect.objectContaining({
          roster_id: 261,
          pri_app_fund_id: 264,
          certified_teacher_flag: "Y",
          sec_app_fund_id: null,
          pri_cred_doc_id: 55,
        }),
      }),
    ]);
    await expect(
      saveRoster("384", { ...member, secondaryFund: "264" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveRoster("384", { ...member, primaryFund: "999" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("hides Add and Edit without activity-roster edit", async () => {
    state.roles[2] = access("activity-roster", "N");
    const view = await rosterView("384");
    expect(view.canAdd).toBe(false);
    expect(view.rows[0].editable).toBe(false);
    await expect(saveRoster("384", member)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("Furniture & Equipment (legacy furnitureEquipmentSection)", () => {
  it("lists the items with their total and posts legacy's body", async () => {
    const view = await equipmentView("384");
    expect(view.rows[0]).toMatchObject({
      key: "181",
      date: "2026-09-01",
      price: 1001,
      fundNames: ["TITLE I"],
    });
    expect(view.total).toBe(1001);
    await saveEquipment("384", item);
    expect(state.writes[0]).toEqual([
      "post",
      {
        appId: 384,
        body: {
          app_id: 384,
          item_description: "Projector",
          purchase_date: "2026-09-01",
          purchase_price: 1001,
          serial_number: "P-1",
          location: "Room 4",
          condition: "New",
          review_comments: null,
          funding_sources: [264],
        },
      },
    ]);
  });
  it("refuses a missing field, another application's item or fund, and a user without the right", async () => {
    await expect(
      saveEquipment("384", { ...item, serial: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveEquipment("384", { ...item, equipment: 9 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveEquipment("384", { ...item, funds: ["999"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      deleteEquipment("384", { equipment: 9 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.roles[3] = access("activity-equipment", "N");
    expect((await equipmentView("384")).canEdit).toBe(false);
    await expect(
      deleteEquipment("384", { equipment: 181 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
