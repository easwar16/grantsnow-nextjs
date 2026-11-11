import { expect, it } from "vitest";
import { vi } from "vitest";
const dependencies = vi.hoisted(() => ({
  proposalPage: vi.fn(),
  pricingDetails: vi.fn(),
  summary: vi.fn(),
  defaultPricing: vi.fn(),
  savePricingLines: vi.fn(),
  resources: vi.fn(),
}));
vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: dependencies.proposalPage,
}));
vi.mock("@/server/oracle/api", () => ({ proposals: dependencies }));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: dependencies.resources,
}));
import {
  mapPricing,
  mapPricingLines,
  mapGlobalFunders,
  savePricingFunder,
  saveGlobalPricingFunder,
  previewPricingReset,
  savePricingReset,
} from "@/server/modules/proposals/pricing";

const row = (overrides: Record<string, unknown> = {}) => ({
  proposal_id: 123,
  funding_section_header_lkp_code: "DA",
  institution_cost: 20,
  funder_cost: 80,
  fec_cost: 100,
  unindex_cost: 50,
  funder_percent: 80,
  private_note: "DO-NOT-EXPOSE",
  ...overrides,
});

it("derives indexed and unindexed totals without posting raw pricing rows", () => {
  const result = mapPricing({ items: [row()] }, "123");
  expect(result).toEqual({
    institution: 20,
    institutionPercent: 0.2,
    funder: 80,
    funderPercent: 0.8,
    unindexedFunderPercent: 1.6,
    indexed: 100,
    unindexed: 50,
    eligible: 0,
  });
  expect(JSON.stringify(result)).not.toContain("DO-NOT-EXPOSE");
});

it("shows the eligible total separately from the indexed total", () => {
  expect(
    mapPricing({ items: [row({ cost_to_funder: 91.5 })] }, "123").eligible,
  ).toBe(91.5);
  expect(
    mapPricing({ items: [row({ cost_to_funder: "XXXXX" })] }, "123").eligible,
  ).toBe("XXXXX");
});

it("previews source defaults and saves explicit lines only after fresh role and record checks", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([
      ["prop-staff-sensitive-data", { read: true }],
      ["prop-non-staff-sensitive-data", { read: true }],
    ]),
  });
  dependencies.summary.mockResolvedValue({
    proposal_id: 123,
    proposal_type: "PROPOSAL",
    sponsors: [{ sponsor_party_id: 44, sponsor_priority: 1 }],
  });
  dependencies.defaultPricing.mockResolvedValue({
    items: [
      row({
        costing_header_id: 7,
        costing_line_id: 8,
        cost_category_lkp_code: "STAFF",
        cost_category_item_lkp_code: "PI",
        staff_name: "Dr A",
        funder_percent: 80,
        cost_to_funder: 100,
      }),
    ],
  });
  dependencies.savePricingLines.mockResolvedValue({});
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      row({
        costing_header_id: 7,
        costing_line_id: 8,
        cost_category_lkp_code: "STAFF",
        cost_category_item_lkp_code: "PI",
      }),
    ],
  });
  const preview = await previewPricingReset("PROPOSAL", "123");
  expect(preview.totals.eligible).toBe(100);
  expect(preview.lines[0].canEdit).toBe(false);
  expect(dependencies.defaultPricing).toHaveBeenCalledWith({
    proposalId: "123",
    sponsorPartyId: 44,
  });
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
  await expect(savePricingReset("PROPOSAL", "123")).resolves.toEqual({
    saved: true,
  });
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    rows: [
      expect.objectContaining({
        FEC_COST: 100,
        FUNDER_CONTRI: 80,
        FUNDER_PCT: 80,
        COST_CATEGORY_TYPE: "STAFF",
        LINE_ID: 8,
        HEADER_ID: 7,
      }),
    ],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([
      ["prop-staff-sensitive-data", { read: true }],
      ["prop-non-staff-sensitive-data", { read: false }],
    ]),
  });
  dependencies.defaultPricing.mockResolvedValueOnce({
    items: [
      row({
        costing_header_id: 7,
        costing_line_id: 8,
        cost_category_lkp_code: "DEFAULT_STAFF",
        funder_percent: 80,
      }),
    ],
  });
  await expect(savePricingReset("PROPOSAL", "123")).resolves.toEqual({
    saved: true,
  });
  expect(dependencies.savePricingLines).toHaveBeenCalledOnce();
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    rows: [expect.objectContaining({ COST_CATEGORY_TYPE: "DEFAULT_STAFF" })],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { edit: false },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
  });
  await expect(savePricingReset("PROPOSAL", "123")).rejects.toThrow(
    /cannot be reset/,
  );
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
});

it("rejects cross-record or masked default pricing before a reset write", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([
      ["prop-staff-sensitive-data", { read: true }],
      ["prop-non-staff-sensitive-data", { read: true }],
    ]),
  });
  dependencies.summary.mockResolvedValue({
    proposal_id: 123,
    proposal_type: "PROPOSAL",
    sponsors: [{ sponsor_party_id: 44, sponsor_priority: 1 }],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.defaultPricing.mockResolvedValueOnce({
    items: [row({ proposal_id: 124, costing_line_id: 8 })],
  });
  await expect(savePricingReset("PROPOSAL", "123")).rejects.toThrow(
    /outside this Proposal/,
  );
  dependencies.defaultPricing.mockResolvedValueOnce({
    items: [row({ costing_line_id: 8, fec_cost: "XXXXX" })],
  });
  dependencies.pricingDetails.mockResolvedValueOnce({
    items: [row({ costing_line_id: 8 })],
  });
  await expect(savePricingReset("PROPOSAL", "123")).rejects.toThrow(
    /Masked default pricing/,
  );
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
});

it("rejects a reset when Oracle defaults reference a different cost line", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
  });
  dependencies.summary.mockResolvedValue({
    proposal_id: 123,
    proposal_type: "PROPOSAL",
    sponsors: [{ sponsor_party_id: 44, sponsor_priority: 1 }],
  });
  dependencies.defaultPricing.mockResolvedValue({
    items: [row({ costing_header_id: 7, costing_line_id: 8 })],
  });
  dependencies.pricingDetails.mockResolvedValue({
    items: [row({ costing_header_id: 7, costing_line_id: 9 })],
  });
  dependencies.savePricingLines.mockClear();
  await expect(savePricingReset("PROPOSAL", "123")).rejects.toThrow(
    /lines changed/,
  );
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
});

it("preserves masked values and rejects malformed or cross-record results", () => {
  const masked = mapPricing(
    { items: [row({ funder_cost: "XXXXX", funder_percent: "XXXXX" })] },
    "123",
  );
  expect(masked.funder).toBe("XXXXX");
  expect(masked.funderPercent).toBe("XXXXX");
  expect(masked.unindexedFunderPercent).toBe("XXXXX");
  expect(() =>
    mapPricing({ items: [row({ proposal_id: 124 })] }, "123"),
  ).toThrow();
  expect(() => mapPricing({ items: {} }, "123")).toThrow();
});

it("retains the backend's unindexed percentage mask even when totals are zero", () => {
  const masked = mapPricing(
    {
      items: [
        row({
          institution_cost: 0,
          funder_cost: 0,
          fec_cost: 0,
          unindex_cost: 0,
          funder_percent_unindexed: "XXXXX",
        }),
      ],
    },
    "123",
  );
  expect(masked.unindexedFunderPercent).toBe("XXXXX");
});

it("maps only scoped pricing lines and funder columns without exposing extra Oracle fields", () => {
  const lines = mapPricingLines(
    {
      items: [
        row({
          costing_line_id: 8,
          costing_header_id: 7,
          proposal_number: "P_123",
          funding_section_header: "Directly Allocated",
          cost_category_lkp_code: "STAFF",
          cost_category: "Staff",
          staff_name: "Dr A",
          party_name: "Funder A",
          funder_details: [
            {
              funder_name: "Funder A",
              funder_contribution: 80,
              cost_to_funder: 100,
            },
          ],
        }),
      ],
    },
    "123",
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({
    id: 8,
    headerId: 7,
    name: "Dr A",
    section: "Directly Allocated",
    funders: [{ name: "Funder A", contribution: 80, eligible: 100 }],
  });
  expect(JSON.stringify(lines)).not.toContain("DO-NOT-EXPOSE");
  expect(() =>
    mapPricingLines(
      { items: [row({ proposal_id: 124, costing_line_id: 8 })] },
      "123",
    ),
  ).toThrow();
});

it("aggregates global funders across pricing lines in priority order", () => {
  const funders = mapGlobalFunders(
    {
      items: [
        row({
          costing_line_id: 8,
          fec_cost: 100,
          unindex_cost: 80,
          funder_details: [
            {
              funder_id: 3,
              funder_name: "Funder B",
              funder_priority: 2,
              funder_contribution: 20,
              cost_to_funder: 25,
            },
            {
              funder_id: 4,
              funder_name: "Funder A",
              funder_priority: 1,
              funder_contribution: 30,
              cost_to_funder: 35,
            },
          ],
        }),
        row({
          costing_line_id: 9,
          fec_cost: 100,
          unindex_cost: 80,
          funder_details: [
            {
              funder_id: 3,
              funder_name: "Funder B",
              funder_priority: 2,
              funder_contribution: 20,
              cost_to_funder: 25,
            },
          ],
        }),
      ],
    },
    "123",
  );
  expect(funders).toEqual([
    {
      id: 4,
      name: "Funder A",
      contribution: 30,
      eligible: 35,
      percent: 0.15,
      unindexedContribution: 24,
      unindexedPercent: 0.1875,
    },
    {
      id: 3,
      name: "Funder B",
      contribution: 40,
      eligible: 50,
      percent: 0.2,
      unindexedContribution: 32,
      unindexedPercent: 0.25,
    },
  ]);
  expect(JSON.stringify(funders)).not.toContain("DO-NOT-EXPOSE");
});

it("includes attached subproposal pricing but rejects unrelated rows", () => {
  const child = row({
    proposal_id: 456,
    proposal_number: "SP_99",
    costing_line_id: 9,
  });
  const data = { items: [row({ costing_line_id: 8 }), child] };
  expect(mapPricingLines(data, "123", ["SP_99"])).toHaveLength(2);
  expect(
    mapPricingLines(
      {
        items: [
          ...data.items,
          row({ proposal_id: 456, proposal_number: null, costing_line_id: 10 }),
        ],
      },
      "123",
      ["SP_99"],
    ),
  ).toHaveLength(3);
  expect(() => mapPricing(data, "123")).toThrow(/outside this Proposal scope/);
  expect(() => mapGlobalFunders(data, "123", ["SP_88"])).toThrow(
    /outside this Proposal scope/,
  );
});

it("does not invent an eligible amount when a funder detail omits it", () => {
  const funder = {
    funder_id: 3,
    funder_name: "Funder A",
    funder_contribution: 0,
  };
  expect(
    mapGlobalFunders({ items: [row({ funder_details: [funder] })] }, "123")[0]
      .eligible,
  ).toBe("—");
  expect(
    mapGlobalFunders(
      { items: [row({ cost_to_funder: "XXXXX", funder_details: [funder] })] },
      "123",
    )[0].eligible,
  ).toBe("XXXXX");
});

it("saves a global funder with Proposal scope and fresh role, resource and data checks", async () => {
  dependencies.resources.mockResolvedValue([
    {
      module_name: "PROPOSAL",
      label_type: "button-labels",
      label_name: "edit-global-values",
      is_visible: "Y",
    },
  ]);
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    bundle: "proposal",
    access: new Map([
      ["prop-staff-sensitive-data", { read: true }],
      ["prop-non-staff-sensitive-data", { read: true }],
    ]),
  });
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      row({
        costing_line_id: 8,
        funder_details: [
          { funder_id: 3, funder_name: "Funder A", funder_contribution: 80 },
        ],
      }),
    ],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.savePricingLines.mockResolvedValue({});
  await expect(
    saveGlobalPricingFunder("PROPOSAL", "123", {
      funderId: 3,
      contribution: 60,
      ruleApplied: "UNINDEXED",
    }),
  ).resolves.toMatchObject({ saved: true, funders: [{ id: 3 }] });
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    funderId: 3,
    rows: [
      expect.objectContaining({
        OBJECT_TYPE: "PROPOSAL_ID",
        OBJECT_ID: 123,
        COLLAB_ID: null,
        FILTER_BY: null,
        FILTER_VALUE: null,
        FUNDING_SECTION: null,
        RULE_APPLIED_ON: "UNINDEXED",
        FEC_COST: 100,
        ELIGIBLE_COST: 0,
        FUNDER_CONTRI: 60,
        FUNDER_PCT: 60,
        INSTITUTE_CONTRI: 20,
        INSTITUTE_PCT: 20,
        SPONSOR_ID: 3,
      }),
    ],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    bundle: "proposal",
    access: new Map([
      ["prop-staff-sensitive-data", { read: true }],
      ["prop-non-staff-sensitive-data", { read: false }],
    ]),
  });
  await expect(
    saveGlobalPricingFunder("PROPOSAL", "123", {
      funderId: 3,
      contribution: 60,
      ruleApplied: "",
    }),
  ).rejects.toThrow(/cannot be edited/);
  await expect(
    saveGlobalPricingFunder("PROPOSAL", "123", {
      funderId: 99,
      contribution: 60,
      ruleApplied: "",
    }),
  ).rejects.toThrow(/outside this Proposal/);
  dependencies.pricingDetails.mockResolvedValueOnce({
    items: [
      row({
        costing_line_id: 8,
        fec_cost: "XXXXX",
        funder_details: [
          { funder_id: 3, funder_name: "Funder A", funder_contribution: 80 },
        ],
      }),
    ],
  });
  await expect(
    saveGlobalPricingFunder("PROPOSAL", "123", {
      funderId: 3,
      contribution: 60,
      ruleApplied: "",
    }),
  ).rejects.toThrow(/Masked pricing/);
  dependencies.resources.mockResolvedValueOnce([
    {
      module_name: "PROPOSAL",
      label_type: "button-labels",
      label_name: "edit-global-values",
      is_visible: "N",
    },
  ]);
  await expect(
    saveGlobalPricingFunder("PROPOSAL", "123", {
      funderId: 3,
      contribution: 60,
      ruleApplied: "",
    }),
  ).rejects.toThrow(/cannot be edited/);
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { edit: true },
    summary: { statusCode: "IA", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    bundle: "proposal",
    access: new Map([
      ["prop-staff-sensitive-data", { read: true }],
      ["prop-non-staff-sensitive-data", { read: true }],
    ]),
  });
  await expect(
    saveGlobalPricingFunder("PROPOSAL", "123", {
      funderId: 3,
      contribution: 60,
      ruleApplied: "",
    }),
  ).rejects.toThrow(/cannot be edited/);
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
});

it("saves one scoped funder line with the VBCS indexed contribution envelope", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([["prop-staff-sensitive-data", { read: true }]]),
  });
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      row({
        costing_header_id: 7,
        costing_line_id: 8,
        cost_category_lkp_code: "STAFF",
        funder_details: [
          { funder_id: 3, funder_name: "Funder A", funder_contribution: 80 },
        ],
      }),
    ],
  });
  dependencies.savePricingLines.mockResolvedValue({});
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      funderId: 3,
      contribution: 60,
      ruleApplied: "UNINDEXED",
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    funderId: 3,
    rows: [
      {
        OBJECT_TYPE: "COSTING_LINE_ID",
        OBJECT_ID: 8,
        FILTER_BY: null,
        FILTER_VALUE: null,
        FUNDING_SECTION: null,
        RULE_APPLIED_ON: "UNINDEXED",
        COLLAB_ID: null,
        FEC_COST: 100,
        ELIGIBLE_COST: 0,
        FUNDER_CONTRI: 60,
        FUNDER_PCT: 60,
        INSTITUTE_CONTRI: 20,
        INSTITUTE_PCT: 20,
        SPONSOR_ID: 3,
      },
    ],
  });
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 9,
      funderId: 3,
      contribution: 60,
      ruleApplied: "INDEXED",
    }),
  ).rejects.toThrow(/outside this Proposal/);
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      funderId: 4,
      contribution: 60,
      ruleApplied: "INDEXED",
    }),
  ).rejects.toThrow(/outside this Pricing line/);
  expect(dependencies.savePricingLines).toHaveBeenCalledTimes(1);
});

it("saves a parent pricing line when an attached subproposal has masked rows", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: {
      statusCode: "DRFT",
      lockedPageIds: [],
      subproposals: [{ proposalNumber: "SP_99", excludePricing: false }],
    },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([["prop-staff-sensitive-data", { read: true }]]),
  });
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      row({
        costing_line_id: 8,
        cost_category_lkp_code: "STAFF",
        funder_details: [
          { funder_id: 3, funder_name: "Funder A", funder_contribution: 80 },
        ],
      }),
      row({
        proposal_id: 456,
        proposal_number: "SP_99",
        costing_line_id: 9,
        fec_cost: "XXXXX",
        cost_category_lkp_code: "STAFF",
      }),
    ],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.savePricingLines.mockResolvedValue({});
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      funderId: 3,
      contribution: 60,
      ruleApplied: "INDEXED",
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    funderId: 3,
    rows: [
      expect.objectContaining({ OBJECT_TYPE: "COSTING_LINE_ID", OBJECT_ID: 8 }),
    ],
  });
});

it("saves a scoped category only after re-reading every line and funder", async () => {
  dependencies.savePricingLines.mockClear();
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: { statusCode: "DRFT", lockedPageIds: [] },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([["prop-staff-sensitive-data", { read: true }]]),
  });
  const staff = (lineId: number, indexed: number, institution: number) =>
    row({
      costing_line_id: lineId,
      collab_id: 7,
      funding_section_header_lkp_code: "DA",
      cost_category_lkp_code: "STAFF",
      cost_category: "Staff",
      fec_cost: indexed,
      institution_cost: institution,
      funder_details: [{ funder_id: 3, funder_name: "Funder A" }],
    });
  dependencies.pricingDetails.mockResolvedValue({
    items: [staff(8, 100, 20), staff(9, 50, 10)],
  });
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      scope: "category",
      funderId: 3,
      contribution: 75,
      ruleApplied: "INDEXED",
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    funderId: 3,
    rows: [
      expect.objectContaining({
        OBJECT_TYPE: "PROPOSAL_ID",
        OBJECT_ID: 123,
        FILTER_BY: "COST_CATEGORY",
        FILTER_VALUE: "Staff",
        FUNDING_SECTION: "DA",
        COLLAB_ID: 7,
        FEC_COST: 150,
        FUNDER_CONTRI: 75,
        FUNDER_PCT: 50,
        INSTITUTE_CONTRI: 30,
        INSTITUTE_PCT: 20,
      }),
    ],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      staff(8, 100, 20),
      {
        ...staff(9, 50, 10),
        funder_details: [{ funder_id: 4, funder_name: "Other" }],
      },
    ],
  });
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      scope: "category",
      funderId: 3,
      contribution: 75,
      ruleApplied: "INDEXED",
    }),
  ).rejects.toThrow(/Pricing group or funder access/);
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
});

it("writes a combined category against the parent using verified parent and subproposal totals", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { edit: true },
    summary: {
      statusCode: "DRFT",
      lockedPageIds: [],
      subproposals: [{ proposalNumber: "SP_99", excludePricing: false }],
    },
    pageIds: new Map([["proposals-pricing", 6]]),
    access: new Map([["prop-staff-sensitive-data", { read: true }]]),
  });
  const staff = (
    proposalId: number,
    proposalNumber: string,
    lineId: number,
    indexed: number,
  ) =>
    row({
      proposal_id: proposalId,
      proposal_number: proposalNumber,
      costing_line_id: lineId,
      cost_category_lkp_code: "STAFF",
      cost_category: "Staff",
      fec_cost: indexed,
      cost_to_funder: indexed - 5,
      institution_cost: indexed - 10,
      funder_details: [
        { funder_id: 3, funder_name: "Funder A", funder_contribution: 0 },
      ],
    });
  dependencies.pricingDetails.mockResolvedValue({
    items: [staff(123, "P_1", 8, 100), staff(456, "SP_99", 9, 50)],
  });
  dependencies.savePricingLines.mockClear();
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      scope: "combined-category",
      funderId: 3,
      contribution: 30,
      ruleApplied: "INDEXED",
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.savePricingLines).toHaveBeenCalledWith({
    funderId: 3,
    rows: [
      expect.objectContaining({
        OBJECT_TYPE: "PROPOSAL_ID",
        OBJECT_ID: 123,
        COLLAB_ID: null,
        FILTER_BY: "COST_CATEGORY",
        FILTER_VALUE: "Staff",
        FUNDING_SECTION: "DA",
        FEC_COST: 150,
        ELIGIBLE_COST: 140,
        INSTITUTE_CONTRI: 130,
        FUNDER_CONTRI: 30,
        FUNDER_PCT: 20,
      }),
    ],
  });
  dependencies.savePricingLines.mockClear();
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      staff(123, "P_1", 8, 100),
      { ...staff(456, "SP_99", 9, 50), collab_id: 7 },
    ],
  });
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      scope: "combined-category",
      funderId: 3,
      contribution: 30,
      ruleApplied: "INDEXED",
    }),
  ).rejects.toThrow(/research partners/);
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
  dependencies.pricingDetails.mockResolvedValue({
    items: [
      staff(123, "P_1", 8, 100),
      staff(456, "SP_99", 9, 50),
      { ...row({ collab_id: 7 }), costing_line_id: null },
    ],
  });
  await expect(
    savePricingFunder("PROPOSAL", "123", {
      lineId: 8,
      scope: "combined-category",
      funderId: 3,
      contribution: 30,
      ruleApplied: "INDEXED",
    }),
  ).rejects.toThrow(/research partners/);
  expect(dependencies.savePricingLines).not.toHaveBeenCalled();
});

it.each([
  {
    label: "missing edit right",
    edit: false,
    statusCode: "DRFT",
    lockedPageIds: [],
    sensitive: true,
  },
  {
    label: "non-draft status",
    edit: true,
    statusCode: "SUBMITTED",
    lockedPageIds: [],
    sensitive: true,
  },
  {
    label: "locked page",
    edit: true,
    statusCode: "DRFT",
    lockedPageIds: [6],
    sensitive: true,
  },
  {
    label: "masked staff costs",
    edit: true,
    statusCode: "DRFT",
    lockedPageIds: [],
    sensitive: false,
  },
])(
  "rejects a Funder Rules write with $label",
  async ({ edit, statusCode, lockedPageIds, sensitive }) => {
    dependencies.savePricingLines.mockClear();
    dependencies.proposalPage.mockResolvedValue({
      rights: { edit },
      summary: { statusCode, lockedPageIds },
      pageIds: new Map([["proposals-pricing", 6]]),
      access: new Map([["prop-staff-sensitive-data", { read: sensitive }]]),
    });
    dependencies.pricingDetails.mockResolvedValue({
      items: [
        row({
          costing_line_id: 8,
          cost_category_lkp_code: "STAFF",
          funder_details: [{ funder_id: 3, funder_name: "Funder A" }],
        }),
      ],
    });
    await expect(
      savePricingFunder("PROPOSAL", "123", {
        lineId: 8,
        funderId: 3,
        contribution: 60,
        ruleApplied: "INDEXED",
      }),
    ).rejects.toThrow();
    expect(dependencies.savePricingLines).not.toHaveBeenCalled();
  },
);
