import { describe, expect, it } from "vitest";
import { columnPlace } from "@/features/record/shell/panel-layout";
import {
  periodBound,
  recalc,
  type BudgetDraft,
} from "@/features/modules/awards/record/budget-model";
import {
  calcPct,
  costTree,
  globalChange,
  splitChange,
  type CostLine,
} from "@/features/modules/awards/record/projects-model";
import {
  withPeriodDates,
  type AwardDetails,
} from "@/server/modules/awards/record";

const draft = (over: Partial<BudgetDraft> = {}): BudgetDraft => ({
  key: "BP_1",
  type: "",
  start: "",
  end: "",
  direct: 60,
  indirect: 40,
  sponsor: 75,
  institution: 25,
  total: 100,
  erpId: "",
  ...over,
});
const line = (over: Partial<CostLine>): CostLine => ({
  id: 1,
  project_id: 1,
  funding_section_lkp_code: "DIRECT",
  funding_section: "Direct",
  cost_category_type_lkp_code: "MATERIALS",
  cost_category: "Materials",
  costing_group_id: null,
  staff_name: "",
  cost_category_description: "",
  cost_start_date: "",
  cost_end_date: "",
  gl_nominal: "",
  gl_nominal_code: "",
  unit_type: "",
  units: null,
  project_hours: null,
  project_months: null,
  sponsor_contribution: 0,
  instituition_contribution: 0,
  total_cost: 0,
  is_editable: true,
  person_id: null,
  project_role_id: null,
  cost_category_item_id: null,
  award_project_link_id: null,
  ...over,
});

describe("budget periods", () => {
  it("keeps the current shares when the total moves", () => {
    expect(recalc(draft(), "total", 200)).toMatchObject({
      direct: 120,
      indirect: 80,
      sponsor: 150,
      institution: 50,
    });
  });
  it("starts the parts at 0 for a period with no total (legacy NaN)", () => {
    const next = recalc(
      draft({ direct: 0, indirect: 0, sponsor: 0, institution: 0, total: 0 }),
      "total",
      50,
    );
    expect([next.direct, next.sponsor]).toEqual([0, 0]);
    expect(next.indirect + next.direct).toBe(50);
  });
  it("bounds a picker by the award date, ignoring a period date outside the award", () => {
    expect(periodBound("2026-01-01", "2026-03-01", true, "2026-12-31")).toBe(
      "2026-03-01",
    );
    expect(periodBound("2026-01-01", "2027-03-01", true, "2026-12-31")).toBe(
      "2026-01-01",
    );
    expect(periodBound("", "", false, "")).toBe("");
  });
});

describe("project costs", () => {
  it("groups lines by section and category, STAFF first, merging a costing group", () => {
    const [project] = costTree([
      line({ id: 1, total_cost: 10, sponsor_contribution: 10 }),
      line({
        id: 2,
        cost_category_type_lkp_code: "STAFF",
        costing_group_id: 5,
        total_cost: 30,
        sponsor_contribution: 15,
        instituition_contribution: 15,
      }),
      line({
        id: 3,
        cost_category_type_lkp_code: "STAFF",
        costing_group_id: 5,
        total_cost: 10,
        sponsor_contribution: 5,
        instituition_contribution: 5,
      }),
    ]);
    const [section] = project.sections;
    expect(section.categories.map((c) => c.code)).toEqual([
      "STAFF",
      "MATERIALS",
    ]);
    expect(section.categories[0].leaves).toHaveLength(1);
    expect(section.categories[0].leaves[0]).toMatchObject({
      total: 40,
      sponsorPct: 0.5,
    });
    expect(project).toMatchObject({ total: 50, sponsor: 30, sponsorPct: 0.6 });
  });
  it("rounds shares to four places and gives 0 without a total", () => {
    expect(calcPct(1, 3)).toBe(0.3333);
    expect(calcPct(5, 0)).toBe(0);
  });
  it("splits the global costs from either side", () => {
    const g = {
      funderCost: 80,
      funderPct: 0.8,
      instiCost: 20,
      instiPct: 0.2,
      total: 100,
    };
    expect(globalChange(g, "INSTI-COST", 50)).toMatchObject({
      funderCost: 50,
      funderPct: 0.5,
    });
    expect(globalChange(g, "TOTAL", 200)).toMatchObject({
      funderCost: 160,
      instiCost: 40,
    });
  });
  it("refuses a negative funder value, an institution above the total and a share above 100%", () => {
    const s = {
      sponsor: 80,
      institution: 20,
      total: 100,
      sponsorPct: 0.8,
      institutionPct: 0.2,
    };
    expect(splitChange(s, "FUND-COST", -1)).toBe(s);
    expect(splitChange(s, "INSTI-COST", 101)).toBe(s);
    // Legacy compared the fraction with 100, so 150% got through.
    expect(splitChange(s, "INSTI-PCT", 1.5)).toBe(s);
    expect(splitChange(s, "FUND-COST", Number.NaN)).toBe(s);
    expect(splitChange(s, "FUND-PCT", 0.25)).toMatchObject({
      sponsor: 25,
      institution: 75,
      institutionPct: 0.75,
    });
  });
});

describe("award dates", () => {
  const award = {
    award_id: 7,
    award_start_date: "2026-05-01",
    award_end_date: "2026-06-01",
  } as AwardDetails;
  it("span the award's own periods", () => {
    expect(
      withPeriodDates(award, [
        {
          award_id: 7,
          award_start_date: "2026-02-01",
          award_end_date: "2026-08-01",
        },
        {
          award_id: 7,
          award_start_date: "2026-01-01",
          award_end_date: "2026-03-01",
        },
        {
          award_id: 8,
          award_start_date: "2025-01-01",
          award_end_date: "2030-01-01",
        },
      ]),
    ).toMatchObject({
      award_start_date: "2026-01-01",
      award_end_date: "2026-08-01",
    });
  });
  it("keep the award's dates with no periods (legacy blanked them)", () => {
    expect(withPeriodDates(award, [])).toMatchObject({
      award_start_date: "2026-05-01",
      award_end_date: "2026-06-01",
    });
  });
});

describe("record panel", () => {
  const columns = (n: number) =>
    Array.from({ length: n }, (_, i) => columnPlace(i, n, 3)?.gridColumn);
  it("fills three columns downwards, the first ones taking the remainder (live 4/3/3 and 4/4/3)", () => {
    expect(columns(10)).toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
    expect(columns(11)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
    expect(columnPlace(4, 10, 3)).toEqual({ gridColumn: 2, gridRow: 1 });
  });
});
