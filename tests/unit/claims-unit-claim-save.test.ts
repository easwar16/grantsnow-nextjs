import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPeriodRange, monthOf } from "@/shared/claims/claim-period";
const state = vi.hoisted(() => ({
  claimStatus: "DRFT",
  lineStatus: "AIA",
  stages: [] as unknown[],
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
vi.mock("@/server/platform/configuration/formatting", () => ({
  globalVariables: async () => [
    { var_key: "ACADEMIC_YEAR_MONTH", var_value: "OCT" },
  ],
}));
vi.mock("@/server/modules/claims/units/record/shell", () => ({
  appSummaryOf: async () => ({ fy_code: 2030 }),
}));
const line = {
  claim_line_id: 1155,
  line_no: 1,
  position_type_code: "NON_POSITION",
  function_code: "1000",
  object_code: "300",
  expenditure_descr: "Stored",
  paid_to_company: "Vendor",
  expenditure_amount: 50,
  defer_payment: "N",
  transaction_no: "T1",
  transaction_date: "2029-10-15",
};
vi.mock("@/server/oracle/api", () => ({
  roles: {
    record: async () => ({
      items: [
        ["claims-unit-summary", "Y", "N"],
        ["claims-unit-claims", "Y", "N"],
        ["unit-add-claim", "Y", "Y"],
      ].map(([page_name, edit, del]) => ({
        page_name,
        read_access: "Y",
        edit_access: edit,
        delete_access: del,
      })),
    }),
  },
  lookups: { codes: async () => ({ items: [] }) },
  approvals: { stages: async () => state.stages },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_HEADER", "DRFT", "Y"],
        ["CLAIM_HEADER", "AIA", "N"],
        ["CLAIM_LINE", "DRFT", "Y"],
        ["CLAIM_LINE", "AIA", "N"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({ items: [{ app_fund_id: 264 }] }),
    fundClaims: async () => ({
      items: [{ claim_id: 874, claim_status_code: state.claimStatus }],
    }),
    fundClaim: async () => ({
      items: [
        {
          claim_id: 874,
          claim_status_code: state.claimStatus,
          claim_period_code: 10,
        },
      ],
    }),
    claimLines: async () => ({
      items: [{ ...line, line_status_code: state.lineStatus }],
    }),
    activityHierarchy: async () => ({
      items: [
        {
          activity_type_code: "NON_POSITION",
          function_codes: [
            { function_code: "1000", object_codes: [{ object_code: "300" }] },
          ],
        },
        {
          activity_type_code: "POSITION",
          function_codes: [
            {
              function_code: "1000",
              object_codes: [
                {
                  object_code: "100",
                  activity_job_titles: [
                    {
                      activity_id: 701,
                      amend_version_id: 921,
                      roster_personnels: [{ roster_id: 261 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
    rejectedLines: async () => ({ items: [{ ...line, claim_line_id: 999 }] }),
    createClaim: async (p: unknown) => {
      state.writes.push(["post", p]);
      return { items: [{ claim_id: 875 }] };
    },
    updateClaim: async (p: unknown) => void state.writes.push(["put", p]),
  },
}));
import { saveClaim } from "@/server/modules/claims/units/record/claims";

const draft = (over = {}) => ({
  lineId: "",
  positionType: "NON_POSITION",
  function: "1000",
  object: "300",
  activity: "",
  version: "",
  expenditure: "Paper",
  category: "",
  categoryItem: "",
  roster: "",
  company: "Vendor",
  amount: "20",
  defer: "N" as const,
  start: "",
  end: "",
  transNo: "T2",
  transDate: "2029-10-20",
  cohort: "",
  rejected: false,
  ...over,
});
beforeEach(() => {
  state.claimStatus = "DRFT";
  state.lineStatus = "AIA";
  state.stages = [];
  state.writes = [];
});

describe("claim period (legacy getTransDateValidators)", () => {
  it("places the claim month in the fiscal year that starts in ACADEMIC_YEAR_MONTH", () => {
    expect(claimPeriodRange(2030, 10, "OCT")).toEqual({
      start: "2029-10-01",
      end: "2029-10-31",
    });
    expect(claimPeriodRange(2030, 2, "OCT")).toEqual({
      start: "2030-02-01",
      end: "2030-02-28",
    });
    expect(claimPeriodRange(2030, 3, "JAN")?.start).toBe("2030-03-01");
    expect(claimPeriodRange("", 3, "JAN")).toBeNull();
    expect([monthOf("October"), monthOf("12"), monthOf(13)]).toEqual([
      10,
      12,
      null,
    ]);
  });
});

describe("Save Claim (legacy saveClaim)", () => {
  it("creates a claim with an explicit pick per line and returns its id", async () => {
    expect(
      await saveClaim("384", {
        fund: "264",
        claim: "",
        period: 10,
        lines: [draft()],
      }),
    ).toEqual({ claim: "875" });
    expect(state.writes[0]).toEqual([
      "post",
      {
        appFundId: 264,
        body: {
          claim_period_code: 10,
          claim_lines: [
            expect.objectContaining({
              claim_line_id: null,
              line_no: null,
              position_type_code: "NON_POSITION",
              expenditure_descr: "Paper",
              expenditure_desc: "Paper",
              paid_to_company: "Vendor",
              roster_id: null,
              expenditure_amount: 20,
              transaction_date: "2029-10-20",
            }),
          ],
        },
      },
    ]);
  });
  it("sends a line the user may not change as stored, and keeps its number", async () => {
    await saveClaim("384", {
      fund: "264",
      claim: "874",
      period: 10,
      lines: [draft({ lineId: "1155", expenditure: "Forged" }), draft()],
    });
    const body = (state.writes[0][1] as { body: { claim_lines: unknown[] } })
      .body;
    expect(body.claim_lines[0]).toMatchObject({
      claim_line_id: 1155,
      line_no: 1,
      expenditure_descr: "Stored",
    });
  });
  it("brings back a rejected line of the period; refuses another claim's line", async () => {
    await saveClaim("384", {
      fund: "264",
      claim: "874",
      period: 10,
      lines: [draft({ lineId: "999" })],
    });
    expect(
      (state.writes[0][1] as { body: { claim_lines: unknown[] } }).body
        .claim_lines[0],
    ).toMatchObject({
      claim_line_id: 999,
      adj_type_code: "REJECT",
      refund_amount: 0,
    });
    await expect(
      saveClaim("384", {
        fund: "264",
        claim: "874",
        period: 10,
        lines: [draft({ lineId: "12345" })],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("checks the picker's codes, the required fields and the period's dates", async () => {
    const save = (over: object) =>
      saveClaim("384", {
        fund: "264",
        claim: "",
        period: 10,
        lines: [draft(over)],
      });
    await expect(save({ object: "999" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(save({ company: " " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      save({
        positionType: "POSITION",
        object: "100",
        activity: "701",
        version: "921",
        roster: "9",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(save({ transDate: "2029-11-01" })).rejects.toMatchObject({
      message: "Transaction Date cannot be later than 2029-10-31.",
    });
    await save({
      positionType: "POSITION",
      object: "100",
      activity: "701",
      version: "921",
      roster: "261",
      company: "",
    });
    expect(state.writes.at(-1)?.[1]).toMatchObject({
      body: {
        claim_lines: [
          expect.objectContaining({
            expenditure_activity_id: 701,
            roster_id: 261,
            paid_to_roster_id: 261,
            paid_to_company: null,
          }),
        ],
      },
    });
  });
  it("refuses a claim that is routed or past a user edit", async () => {
    state.stages = [{ stage_id: 1 }];
    await expect(
      saveClaim("384", { fund: "264", claim: "874", period: 10, lines: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.stages = [];
    state.claimStatus = "AIA";
    await expect(
      saveClaim("384", { fund: "264", claim: "874", period: 10, lines: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
