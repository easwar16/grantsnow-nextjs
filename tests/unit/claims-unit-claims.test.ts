import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  claims: [] as Record<string, unknown>[],
  roleEdit: "Y",
  roleDelete: "Y",
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
        ["unit-add-claim", state.roleEdit, state.roleDelete],
      ].map(([page_name, edit, del]) => ({
        page_name,
        read_access: "Y",
        edit_access: edit,
        delete_access: del,
      })),
    }),
  },
  lookups: { codes: async () => ({ items: [] }) },
  reports: { generate: async () => ({}) },
  claims: {
    statusConfigs: async () => ({
      items: [
        ["CLAIM_HEADER", "DRFT", "Y"],
        ["CLAIM_HEADER", "AIA", "N"],
      ].map(([t, s, y]) => ({
        transaction_type: t,
        status_lookup_code: s,
        allow_user_edit: y,
      })),
    }),
    appFunds: async () => ({ items: [{ app_fund_id: 264, fund_type_id: 1 }] }),
    fundCategories: async () => ({
      items: [{ fund_status_code: "IA", approved_amount: 11000 }],
    }),
    fundClaims: async () => ({ items: state.claims }),
    claimsSummary: async () => ({
      items: [
        {
          function_code: "1000",
          obj_100_claimed: 10,
          obj_200_claimed: null,
          function_total_claimed: 10,
        },
        { function_code: "2120", obj_100_claimed: 5 },
      ],
    }),
    cloneClaim: async (p: unknown) => void state.writes.push(["clone", p]),
    deleteClaim: async (p: unknown) => void state.writes.push(["delete", p]),
  },
}));
import {
  claimFigures,
  claimsListView,
  claimsSummaryView,
  claimsView,
  cloneClaim,
  deleteClaim,
} from "@/server/modules/claims/units/record/claims";

const claim = (id: number, status: string, over = {}) => ({
  claim_id: id,
  claim_number: String(id),
  claim_status_code: status,
  claim_amount: 100,
  approved_amount: 80,
  total_adjust_amount: 10,
  approved_adjust_amount: 5,
  paid_amount: 20,
  ...over,
});
beforeEach(() => {
  state.claims = [
    claim(1, "DRFT"),
    claim(2, "AIA"),
    claim(3, "PAID"),
    claim(4, ""),
  ];
  state.roleEdit = "Y";
  state.roleDelete = "Y";
  state.writes = [];
});

describe("Claims tab (legacy claims-unit-claims)", () => {
  it("figures as legacy getClaimFigures: drafts not claimed, AIA counted at claim, settled at approved less adjustments", () => {
    expect(claimFigures(state.claims as never, 1000)).toEqual({
      claimed: 300,
      approved: 320,
      refunds: 20,
      paid: 80,
      remaining: 1000 - (100 + (80 - 10)),
    });
    expect(claimFigures([], null).remaining).toBeNull();
  });
  it("shows the fund bar with the claims' figures only behind their RB rows", async () => {
    const view = await claimsView("384", null);
    expect(view.fund).toBe("264");
    expect(view.amounts.map((a) => a.key)).toEqual([
      "total-allocation",
      "approved-amount",
    ]);
    expect(view.statuses[0]).toEqual({ value: "", label: "All" });
  });
  it("sums the Claims Summary's columns, a missing amount as 0", async () => {
    const s = await claimsSummaryView("384", "264");
    expect(s.totals.obj_100_claimed).toBe(15);
    expect(s.totals.obj_200_claimed).toBe(0);
    expect(s.rows[0].amounts.obj_200_claimed).toBeNull();
  });
  it("clones only an approved or paid claim, deletes only a new or editable one (hidden otherwise)", async () => {
    const list = await claimsListView("384", "264", "");
    const rights = Object.fromEntries(
      list.rows.map((r) => [r.key, [r.canClone, r.canDelete]]),
    );
    expect(rights).toEqual({
      "1": [false, true],
      "2": [false, false],
      "3": [true, false],
      "4": [false, true],
    });
    await cloneClaim("384", { fund: "264", claim: "3" });
    await deleteClaim("384", { fund: "264", claim: "1" });
    expect(state.writes).toEqual([
      ["clone", { claimId: 3 }],
      ["delete", { claimId: 1 }],
    ]);
    await expect(
      cloneClaim("384", { fund: "264", claim: "1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      deleteClaim("384", { fund: "264", claim: "2" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      deleteClaim("384", { fund: "264", claim: "99" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("hides Clone and Delete without the unit-add-claim rights", async () => {
    state.roleEdit = "N";
    state.roleDelete = "N";
    const list = await claimsListView("384", "264", "");
    expect(list.rows.some((r) => r.canClone || r.canDelete)).toBe(false);
  });
});
