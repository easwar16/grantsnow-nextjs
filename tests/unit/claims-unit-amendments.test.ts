import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as Record<string, string>[],
  fundStatus: "IA",
  amendmentStatus: "ADJ_DRFT",
  lines: [] as Record<string, unknown>[],
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
  lookups: {
    codes: async () => ({
      items: [
        {
          lookup_type_code: "FPCG_AMENDMENT_REASON",
          lookup_code: "SCHOOL_ADJUSTMENT",
          lookup_code_value: "School Budget Adjustment",
        },
        {
          lookup_type_code: "FPCG_AMENDMENT_STATUS",
          lookup_code: "ADJ_DRFT",
          lookup_code_value: "Pending",
        },
      ],
    }),
  },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_FUNDS_AMENDMENT", "ADJ_DRFT", "Y"],
        ["CLAIM_FUNDS_AMENDMENT", "ADJ_AIA", "N"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({
      items: [
        {
          app_fund_id: 264,
          fund_type_id: 1,
          fund_status_code: state.fundStatus,
        },
      ],
    }),
    amendments: async () => ({
      items: [
        {
          amendment_id: 603,
          amendment_number: 1,
          status_code: state.amendmentStatus,
          status_code_descr: "Pending",
          reason: "SCHOOL_ADJUSTMENT",
          no_of_lines: state.lines.length,
        },
      ],
    }),
    amendmentLines: async () => ({ items: state.lines }),
    activities: async () => ({
      items: [
        {
          activity_id: 704,
          amend_version_id: 924,
          activity_number: 5,
          activity_type_code: "NON_POSITION",
        },
      ],
    }),
    includeInAmendment: async (p: unknown) => {
      state.writes.push(["include", p]);
      return { items: [{ amendment_id: 604 }] };
    },
    saveAmendment: async (p: unknown) => void state.writes.push(["save", p]),
    deleteAmendment: async (p: unknown) =>
      void state.writes.push(["delete", p]),
    deleteAmendmentLine: async (p: unknown) =>
      void state.writes.push(["delete-line", p]),
  },
}));
import {
  amendmentLinesView,
  amendmentsView,
  deleteAmendment,
  includeActivities,
  saveAmendment,
} from "@/server/modules/claims/units/record/amendments";

const access = (page: string, edit = "Y", del = "Y") => ({
  page_name: page,
  read_access: "Y",
  edit_access: edit,
  delete_access: del,
});
beforeEach(() => {
  state.roles = [
    access("claims-unit-summary"),
    access("claims-unit-activities"),
    access("activity-amendment"),
  ];
  state.fundStatus = "IA";
  state.amendmentStatus = "ADJ_DRFT";
  state.lines = [
    {
      amendment_id: 603,
      activity_id: 704,
      amend_version_id: 1855,
      activity_number: 5,
      itemization_text: "x",
      justification: "y",
    },
  ];
  state.writes = [];
});

describe("Amendments", () => {
  it("opens only for a fund status that allows amendments (legacy li#amendments)", async () => {
    const view = await amendmentsView("384", "264", "");
    expect(view.rows[0]).toMatchObject({
      key: "603",
      editable: true,
      deletable: true,
    });
    expect(view.reasons).toEqual([
      { value: "SCHOOL_ADJUSTMENT", label: "School Budget Adjustment" },
    ]);
    state.fundStatus = "DRFT";
    await expect(amendmentsView("384", "264", "")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("includes the fund's activities with legacy's body and returns the minted amendment", async () => {
    const result = await includeActivities("384", {
      fund: "264",
      reason: "SCHOOL_ADJUSTMENT",
      activities: [{ activity: "704", version: "924" }],
    });
    expect(result).toEqual({ amendment: "604" });
    expect(state.writes[0]).toEqual([
      "include",
      {
        appFundId: 264,
        amendmentId: undefined,
        body: {
          fund_type_id: 1,
          reason: "SCHOOL_ADJUSTMENT",
          includeActivities: [
            {
              activity_id: 704,
              amend_version_id: 924,
              activity_type_code: "NON_POSITION",
            },
          ],
        },
      },
    ]);
    await expect(
      includeActivities("384", {
        fund: "264",
        reason: "SCHOOL_ADJUSTMENT",
        activities: [{ activity: "999", version: "1" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      includeActivities("384", {
        fund: "264",
        reason: "MADE_UP",
        activities: [{ activity: "704", version: "924" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("saves only when every line has its justification and itemization (legacy saveAmendment)", async () => {
    state.lines[0].justification = "";
    await expect(
      saveAmendment("384", {
        fund: "264",
        amendment: "603",
        reason: "SCHOOL_ADJUSTMENT",
      }),
    ).rejects.toMatchObject({
      message: "Please check Justification/Itemization for Activity: 5",
    });
    state.lines[0].justification = "ok";
    await saveAmendment("384", {
      fund: "264",
      amendment: "603",
      reason: "SCHOOL_ADJUSTMENT",
    });
    expect(state.writes.at(-1)).toEqual([
      "save",
      { amendmentId: 603, body: { reason: "SCHOOL_ADJUSTMENT" } },
    ]);
  });
  it("a line is removed by the amendment's status, not the line's; an amendment under review is closed", async () => {
    await deleteAmendment("384", {
      fund: "264",
      amendment: "603",
      version: "1855",
    });
    expect(state.writes.at(-1)).toEqual([
      "delete-line",
      { amendmentId: 603, versionId: 1855 },
    ]);
    await expect(
      deleteAmendment("384", { fund: "264", amendment: "603", version: "9" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.amendmentStatus = "ADJ_AIA";
    expect((await amendmentLinesView("384", "264", "603")).deletable).toBe(
      false,
    );
    await expect(
      deleteAmendment("384", { fund: "264", amendment: "603" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      includeActivities("384", {
        fund: "264",
        amendment: "603",
        reason: "SCHOOL_ADJUSTMENT",
        activities: [{ activity: "704", version: "924" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("hides delete and edit without the activity-amendment rights", async () => {
    state.roles = [
      access("claims-unit-summary"),
      access("claims-unit-activities"),
      access("activity-amendment", "N", "N"),
    ];
    const view = await amendmentsView("384", "264", "");
    expect(view.canCreate).toBe(false);
    expect(view.rows[0]).toMatchObject({ editable: false, deletable: false });
  });
});
