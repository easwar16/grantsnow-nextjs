import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  claimStatus: "PAID",
  adjStatus: "DRFT",
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
vi.mock("@/server/oracle/api", () => ({
  roles: {
    record: async () => ({
      items: [
        ["claims-unit-summary", "Y", "N"],
        ["claims-unit-claims", "Y", "N"],
        ["unit-claim-adjustment", "Y", "Y"],
      ].map(([page_name, edit, del]) => ({
        page_name,
        read_access: "Y",
        edit_access: edit,
        delete_access: del,
      })),
    }),
  },
  lookups: {
    codes: async () => ({
      items: [
        ["RECLASS", "Re-classify"],
        ["REJECT", "Reject"],
      ].map(([lookup_code, lookup_code_value]) => ({
        lookup_type_code: "FPCG_ADJ_LINE_TYPE",
        lookup_code,
        lookup_code_value,
      })),
    }),
  },
  people: { all: async () => [{ person_id: 7, full_name: "Ada Lovelace" }] },
  approvals: { stages: async () => state.stages },
  reports: { generate: async () => ({}) },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_ADJUSTMENT_HEADER", "DRFT", "Y"],
        ["CLAIM_ADJUSTMENT_HEADER", "AIA", "N"],
        ["CLAIM_ADJUSTMENT_LINE", "DRFT", "Y"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({ items: [{ app_fund_id: 264 }] }),
    fundClaims: async () => ({
      items: [{ claim_id: 442, claim_status_code: state.claimStatus }],
    }),
    claimLines: async () => ({
      items: [
        {
          claim_line_id: 622,
          line_no: 2,
          position_type_code: "POSITION",
          function_code: "1000",
          object_code: "200",
          expenditure_descr: "2-Teacher",
          expenditure_amount: 800,
        },
      ],
    }),
    activityHierarchy: async () => ({
      items: [
        {
          activity_type_code: "POSITION",
          function_codes: [
            {
              function_code: "1000",
              object_codes: [{ object_code: "100" }, { object_code: "200" }],
            },
          ],
        },
      ],
    }),
    adjustments: async () => ({
      items: [
        { claim_adj_id: 604, adj_status_code: state.adjStatus, created_by: 7 },
      ],
    }),
    adjustment: async () => ({
      items: [{ claim_adj_id: 604, adj_status_code: state.adjStatus }],
    }),
    adjustmentLines: async () => ({ items: [] }),
    createAdjustment: async (p: unknown) => {
      state.writes.push(["post", p]);
      return { items: [{ claim_adj_id: 605 }] };
    },
    updateAdjustment: async (p: unknown) => void state.writes.push(["put", p]),
    deleteAdjustment: async (p: unknown) =>
      void state.writes.push(["delete", p]),
  },
}));
import {
  adjustmentsView,
  deleteAdjustment,
  saveAdjustment,
} from "@/server/modules/claims/units/record/adjustments";

const line = (over = {}) => ({
  adjLineId: "",
  claimLineId: "622",
  type: "REJECT",
  toFunction: "",
  toObject: "",
  justification: "Refund",
  refund: "10",
  ...over,
});
const save = (lines: ReturnType<typeof line>[], over = {}) =>
  saveAdjustment("384", {
    fund: "264",
    claim: "442",
    adjustment: "",
    refundCheck: "R1",
    comment: "C",
    lines,
    ...over,
  });
beforeEach(() => {
  state.claimStatus = "PAID";
  state.adjStatus = "DRFT";
  state.stages = [];
  state.writes = [];
});

describe("Adjustments (legacy claims-adjustments)", () => {
  it("open only on an approved or paid claim; the list names who adjusted", async () => {
    const view = await adjustmentsView("384", "264", "442");
    expect(view.rows[0]).toMatchObject({
      key: "604",
      by: "Ada Lovelace",
      canDelete: true,
    });
    state.claimStatus = "DRFT";
    await expect(adjustmentsView("384", "264", "442")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("saves legacy's pick: a REJECT line's refund, a RECLASS line's new codes and no refund", async () => {
    expect(await save([line()])).toEqual({ adjustment: "605" });
    expect(state.writes[0]).toEqual([
      "post",
      {
        claimId: 442,
        body: {
          refund_check_ach_no: "R1",
          cps_comment: "C",
          adjustment_lines: [
            {
              claim_adj_line_id: null,
              claim_line_id: 622,
              adj_type_code: "REJECT",
              from_function_code: "1000",
              from_object_code: "200",
              to_function_code: null,
              to_object_code: null,
              justification: "Refund",
              refund_amount: 10,
              reviewer_comment: null,
            },
          ],
        },
      },
    ]);
    await save([
      line({
        type: "RECLASS",
        toFunction: "1000",
        toObject: "100",
        refund: "5",
      }),
    ]);
    expect(
      (state.writes[1][1] as { body: { adjustment_lines: unknown[] } }).body
        .adjustment_lines[0],
    ).toMatchObject({ to_object_code: "100", refund_amount: 0 });
  });
  it("refuses with legacy's messages", async () => {
    await expect(save([line()], { refundCheck: " " })).rejects.toMatchObject({
      message: "Refund Check Number Missing",
    });
    await expect(save([line()], { comment: "" })).rejects.toMatchObject({
      message: "Adjustment Comment Missing",
    });
    await expect(save([line({ justification: "" })])).rejects.toMatchObject({
      message: "No Justification",
      action: "Provide justification for Expenditure : 2-Teacher",
    });
    await expect(save([line({ refund: "0" })])).rejects.toMatchObject({
      message: "No Amount",
    });
    await expect(
      save([line({ type: "RECLASS", toFunction: "1000", toObject: "200" })]),
    ).rejects.toMatchObject({
      message: "Save values selected for re-classification",
    });
    await expect(save([line({ claimLineId: "999" })])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("refuses a routed or closed adjustment, and deletes only an open one", async () => {
    await deleteAdjustment("384", {
      fund: "264",
      claim: "442",
      adjustment: "604",
    });
    expect(state.writes.at(-1)).toEqual(["delete", { adjustmentId: 604 }]);
    state.adjStatus = "AIA";
    await expect(
      deleteAdjustment("384", { fund: "264", claim: "442", adjustment: "604" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(save([line()], { adjustment: "604" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
