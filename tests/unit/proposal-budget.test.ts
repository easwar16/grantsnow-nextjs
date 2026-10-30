import { expect, it } from "vitest";
import {
  mapBudget,
  staffLine,
  sumCost,
} from "@/server/modules/proposals/budget";

const row = (overrides: Record<string, unknown> = {}) => ({
  proposal_id: 123,
  proposal_number: "P_123",
  costing_header_id: 10,
  funding_header: "FUND",
  funding_header_description: "University funding",
  cost_category_lkp_code: "STAFF",
  cost_category_type_value: "Staff",
  staff_name: "Research assistant",
  project_role: "Researcher",
  fte: 0,
  unindex_cost: 0,
  fec_cost: 250,
  internal_note: "DO-NOT-EXPOSE",
  ...overrides,
});

it("groups cost lines in backend order, places staff first, and keeps zero values", () => {
  const result = mapBudget(
    {
      items: [
        row({
          costing_header_id: 11,
          cost_category_lkp_code: "TRAVEL",
          cost_category_type_value: "Travel",
          staff_name: "Site visit",
          fec_cost: 50,
        }),
        row(),
      ],
    },
    "123",
  );
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0].categories.map((category) => category.name)).toEqual([
    "Staff",
    "Travel",
  ]);
  expect(result.groups[0].categories[0].rows[0].fte).toBe(0);
  expect(result.groups[0].categories[0].rows[0].hours).toBe(0);
  expect(
    mapBudget({ items: [row({ project_hours: "0" })] }, "123").groups[0]
      .categories[0].rows[0].hours,
  ).toBe("0");
  expect(result.total).toBe(300);
  expect(JSON.stringify(result)).not.toContain("DO-NOT-EXPOSE");
});

it("separates primary and research partner totals using the VBCS collaborator key", () => {
  const result = mapBudget(
    {
      items: [
        row({ costing_header_id: 10, fec_cost: 0 }),
        row({
          costing_header_id: 11,
          collab_id: 32,
          collab_name: "Lancaster University",
          cost_category_lkp_code: "EQUIP",
          cost_category_type_value: "Equipment",
          fec_cost: 10.73,
          unindex_cost: 10,
          cost_year_splits: [
            {
              period_label: "2026/27",
              unindexed_cost: 10,
              indexed_cost: 10.73,
            },
          ],
        }),
      ],
    },
    "123",
  );
  expect(result.projects.map((project) => project.name)).toEqual([
    "Primary",
    "Lancaster University",
  ]);
  expect(result.projects.map((project) => project.total)).toEqual([0, 10.73]);
  expect(result.projects[0].groups[0].categories[0].name).toBe("Staff");
  expect(result.projects[1].groups[0].categories[0].name).toBe("Equipment");
  expect(result.total).toBe(10.73);
  expect(result.projects[0].yearSplits).toEqual([]);
  expect(result.projects[1].yearSplits).toEqual([
    { period: "2026/27", unindexed: 10, indexed: 10.73 },
  ]);
});

it("fails closed for malformed or cross-proposal cost results", () => {
  expect(() =>
    mapBudget({ items: [row({ proposal_id: 124 })] }, "123"),
  ).toThrow();
  expect(() => mapBudget({ items: {} }, "123")).toThrow();
});

it("allows only a staff header present in the authorized budget result", () => {
  const budget = mapBudget(
    {
      items: [
        row({ costing_header_id: 10 }),
        row({ costing_header_id: 11, cost_category_lkp_code: "TRAVEL" }),
      ],
    },
    "123",
  );
  expect(staffLine(budget, 10).name).toBe("Research assistant");
  expect(() => staffLine(budget, 11)).toThrow();
  expect(() => staffLine(budget, 999)).toThrow();
});

it("preserves masked amounts and treats empty amounts as empty", () => {
  expect(sumCost([0, "", null])).toBe(0);
  expect(sumCost([10, "****"])).toBe("****");
});
