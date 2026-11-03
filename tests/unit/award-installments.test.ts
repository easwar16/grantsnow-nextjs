import { describe, expect, it } from "vitest";
import {
  balance,
  buildInstallments,
  effectiveStatus,
  funderTotal,
  installmentTotal,
  maxValue,
  parseInstallments,
  type Installment,
  type InstallmentLine,
} from "@/features/modules/awards/record/installments-model";

const line = (over: Partial<InstallmentLine>): InstallmentLine => ({
  project_id: 1,
  funding_section_lkp_code: "DIRECT",
  funding_section: "Direct",
  cost_category_type_lkp_code: "MATERIALS",
  cost_category: "Materials",
  costing_group_id: null,
  staff_name: "",
  sponsor_contribution: 0,
  ...over,
});
const lines = [
  line({ costing_group_id: 1, sponsor_contribution: 100 }),
  line({ costing_group_id: 2, sponsor_contribution: 100 }),
  line({
    costing_group_id: 3,
    cost_category_type_lkp_code: "STAFF",
    cost_category: "Staff",
    staff_name: "Alex",
    sponsor_contribution: 100,
  }),
];
const installment = (over: Partial<Installment>): Installment => ({
  title: "T",
  mode: "AMOUNT",
  amount: 100,
  pct: null,
  due_date: null,
  status: "INITIATED",
  ...over,
});

describe("installments (legacy awards-installments)", () => {
  it("takes a percentage of the whole funder total and leaves the edited one out of the balance", () => {
    const list = [installment({}), installment({ mode: "PERCENT", pct: 0.5 })];
    expect(funderTotal(lines)).toBe(300);
    expect(installmentTotal(list[1], 300)).toBe(150);
    expect(balance(lines, list)).toBe(50);
    expect(balance(lines, list, 2, 1)).toBe(200);
    expect(maxValue(lines, list, 2, 1, "PERCENT")).toBeCloseTo(200 / 300);
  });
  it("prorates each installment so its lines add up to it exactly, staff first", () => {
    const [first, second] = buildInstallments(
      lines,
      [{ project_id: 1, project_number: "PRJ_1", project_name: "P" }],
      [installment({ amount: 100 }), installment({ amount: 100 })],
    );
    const leaves = (s: typeof first) =>
      s.projects[0].sections[0].children.flatMap((c) => c.children);
    expect(first.projects[0].title).toBe("PRJ_1 - P");
    expect(first.projects[0].sections[0].children[0].name).toBe("Staff");
    expect(leaves(first).map((l) => l.installment_amount)).toEqual([
      33.34, 33.33, 33.33,
    ]);
    expect(first.projects[0].installment_amount).toBe(100);
    // The running total is prorated, so the second picks up the cents the first rounded.
    expect(second.projects[0].installment_amount).toBe(100);
    expect(second.projects[0].remaining_balance).toBe(100);
  });
  it("shows Overdue past the due date unless Fulfilled, keeping the stored status", () => {
    expect(
      effectiveStatus(installment({ due_date: "2026-01-01" }), "2026-02-01")
        .value,
    ).toBe("OVERDUE");
    expect(
      effectiveStatus(
        installment({ due_date: "2026-01-01", status: "FULFILLED" }),
        "2026-02-01",
      ).value,
    ).toBe("FULFILLED");
    expect(effectiveStatus(installment({}), "2026-02-01").value).toBe(
      "INITIATED",
    );
  });
  it("reads anything unreadable from the session as no installments", () => {
    expect(parseInstallments("not json")).toEqual([]);
    expect(parseInstallments("{}")).toEqual([]);
  });
});

describe("award form slots", () => {
  it("maps each award slot to its own tab's page, and refuses any other", async () => {
    const { pageOf } = await import("@/server/record/dynamic-form/access");
    expect(pageOf({ objectType: "AWARD", slot: "AWARDS-MILESTONES" })).toBe(
      "awards-milestones",
    );
    expect(pageOf({ objectType: "AWARD", slot: "AWARDS-HEADER" })).toBe(
      "awards-header",
    );
    expect(pageOf({ objectType: "AWARD", slot: "AWARDS-BUDGET" })).toBeNull();
  });
});
