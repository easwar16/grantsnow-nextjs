import { beforeEach, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  scope: vi.fn(),
  options: vi.fn(),
  forms: vi.fn(),
  salaryModels: vi.fn(),
  costForms: vi.fn(),
  orgUnits: vi.fn(),
  codes: vi.fn(),
  costHeaderDetails: vi.fn(),
  costingLines: vi.fn(),
  calculateStaffLine: vi.fn(),
  saveCostingLines: vi.fn(),
}));
vi.mock("@/server/modules/proposals/quick-cost", () => ({
  costingScope: dependencies.scope,
  quickCostOptions: dependencies.options,
}));
vi.mock("@/server/record/dynamic-form/forms", () => ({
  mapForms: dependencies.forms,
}));
vi.mock("@/server/oracle/api", () => ({
  proposals: dependencies,
  dynamicForm: { forms: dependencies.costForms },
  lookups: { orgUnits: dependencies.orgUnits, codes: dependencies.codes },
}));

import { saveStaffCostLines } from "@/server/modules/proposals/record/staff-entry";

const input = {
  kind: "staff",
  versionId: 22,
  costHeaderId: 33,
  lines: [
    {
      id: 44,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      unitType: "PROJ_FTE",
      units: 0.5,
      baseline: null,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.scope.mockResolvedValue({
    context: {
      access: new Map([["prop-staff-hdr-sal-data", { edit: false }]]),
      summary: { detailColumns: [] },
    },
    data: {
      cost_model: 338,
      proposal_start_date: "2027-01-01",
      proposal_end_date: "2027-12-31",
    },
  });
  dependencies.options.mockResolvedValue({
    versionId: 22,
    sections: [],
    roles: [],
    people: [],
  });
  dependencies.forms.mockReturnValue([]);
  dependencies.salaryModels.mockResolvedValue({ items: [] });
  dependencies.costForms.mockResolvedValue({ items: [] });
  dependencies.orgUnits.mockResolvedValue({ items: [] });
  dependencies.codes.mockResolvedValue({
    items: [{ lookup_code: "PROJ_FTE", lookup_code_descr: "Project FTE" }],
  });
  dependencies.costHeaderDetails.mockResolvedValue({
    cost_header: {
      costing_header_id: 33,
      proposal_id: 1000,
      proposal_period_version_id: 22,
      cost_category_lkp_code: "STAFF",
      cost_category_item_lkp_code: "PI",
    },
  });
  dependencies.costingLines.mockResolvedValue({
    items: [
      {
        costing_header_id: 33,
        costing_line_id: 44,
        proposal_id: 1000,
        costmodel_id: 338,
        cost_type: "STAFF",
        salary_model: "PB",
        funding_section_hdr: "DA",
        cost_category_type: "STAFF",
        cost_category_item: "PI",
        currency_code: "GBP",
        exchange_rate: 1,
        fte: 1,
        hr_fte: 1,
        years: 1,
        baseline_cost: 100,
        unit_cost: 100,
        unindex_cost: 100,
      },
    ],
  });
  dependencies.calculateStaffLine.mockResolvedValue({
    cost_summary: [{ line_id: 44, fec_total: 120, unindex_cost: 110 }],
  });
  dependencies.saveCostingLines.mockResolvedValue({});
});

it("calculates and saves an explicit scoped cost line", async () => {
  await expect(saveStaffCostLines("PROPOSAL", "1000", input)).resolves.toEqual({
    saved: true,
  });
  expect(dependencies.calculateStaffLine).toHaveBeenCalledOnce();
  expect(dependencies.saveCostingLines).toHaveBeenCalledWith({
    rows: [
      expect.objectContaining({
        costing_line_id: 44,
        proposal_id: 1000,
        unit_type: "PROJ_FTE",
        units: 0.5,
        baseline_cost: 100,
        fec_total: 120,
        unindex_cost: 110,
      }),
    ],
  });
});

it("normalizes Oracle display dates before validating and calculating", async () => {
  dependencies.scope.mockResolvedValueOnce({
    context: {
      access: new Map([["prop-staff-hdr-sal-data", { edit: false }]]),
      summary: { detailColumns: [] },
    },
    data: {
      cost_model: 338,
      proposal_start_date: "01-Jan-2027",
      proposal_end_date: "31-Dec-2027",
    },
  });
  await saveStaffCostLines("PROPOSAL", "1000", input);
  expect(dependencies.calculateStaffLine).toHaveBeenCalledWith({
    row: expect.objectContaining({
      proposal_start_date: "2027-01-01",
      proposal_end_date: "2027-12-31",
    }),
  });
});

it("rejects a header from another Proposal or Budget version before calculation", async () => {
  dependencies.costHeaderDetails.mockResolvedValueOnce({
    cost_header: {
      costing_header_id: 33,
      proposal_id: 1001,
      proposal_period_version_id: 22,
      cost_category_lkp_code: "STAFF",
      cost_category_item_lkp_code: "PI",
    },
  });
  await expect(saveStaffCostLines("PROPOSAL", "1000", input)).rejects.toThrow(
    /outside/,
  );
  dependencies.costHeaderDetails.mockResolvedValueOnce({
    cost_header: {
      costing_header_id: 33,
      proposal_id: 1000,
      proposal_period_version_id: 21,
      cost_category_lkp_code: "STAFF",
      cost_category_item_lkp_code: "PI",
    },
  });
  await expect(saveStaffCostLines("PROPOSAL", "1000", input)).rejects.toThrow(
    /outside/,
  );
  expect(dependencies.calculateStaffLine).not.toHaveBeenCalled();
  expect(dependencies.saveCostingLines).not.toHaveBeenCalled();
});

it("rejects invalid dates and unauthorized baseline edits before a write", async () => {
  await expect(
    saveStaffCostLines("PROPOSAL", "1000", {
      ...input,
      lines: [{ ...input.lines[0], endDate: "2028-01-01" }],
    }),
  ).rejects.toThrow(/period/);
  await expect(
    saveStaffCostLines("PROPOSAL", "1000", {
      ...input,
      lines: [{ ...input.lines[0], baseline: 500 }],
    }),
  ).rejects.toThrow(/cannot be edited/);
  expect(dependencies.calculateStaffLine).not.toHaveBeenCalled();
});

it("does not save when the calculation response lacks the requested line", async () => {
  dependencies.calculateStaffLine.mockResolvedValueOnce({ cost_summary: [] });
  await expect(saveStaffCostLines("PROPOSAL", "1000", input)).rejects.toThrow(
    /no calculation/,
  );
  expect(dependencies.saveCostingLines).not.toHaveBeenCalled();
});
